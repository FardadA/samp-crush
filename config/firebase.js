const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Firebase private key might be a multi-line string.
// It's often easier to base64 encode it and store it in .env, then decode it here.
// Or, ensure the .env parser handles multi-line strings correctly.
// For simplicity here, we assume it's correctly formatted in .env or directly provided.
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

let db;

try {
  if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseProjectId,
        clientEmail: firebaseClientEmail,
        privateKey: firebasePrivateKey,
      }),
    });
    db = admin.firestore();
    console.log('Firebase Admin SDK initialized successfully. Connected to Firestore.');
  } else {
    console.warn('Firebase credentials not found in .env file. Firestore will not be available.');
    db = null;
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  db = null;
}

/**
 * Firestore Database Instance
 */
module.exports.db = db;
// Export FieldValue for server timestamps etc.
module.exports.FieldValue = db ? admin.firestore.FieldValue : null;


/**
 * Retrieves a user document from Firestore.
 * @param {number} userId - The Telegram user ID.
 * @returns {Promise<admin.firestore.DocumentSnapshot | null>} The user document snapshot or null if not found or db is not available.
 */
module.exports.getUser = async (userId) => {
  if (!db) {
    console.warn('Firestore is not available. Cannot get user.');
    return null;
  }
  try {
    const userRef = db.collection('users').doc(String(userId));
    const doc = await userRef.get();
    return doc; // Returns the DocumentSnapshot
  } catch (error) {
    console.error(`Error getting user ${userId} from Firestore:`, error);
    return null;
  }
};

/**
 * Creates or updates a user document in Firestore.
 * @param {number} userId - The Telegram user ID.
 * @param {object} data - The data to set or merge for the user.
 * @param {boolean} merge - Whether to merge the data with existing document (default: true).
 * @returns {Promise<void | null>} A promise that resolves when the write is complete, or null if db is not available.
 */
module.exports.updateUser = async (userId, data, merge = true) => {
  if (!db) {
    console.warn('Firestore is not available. Cannot update user.');
    return null;
  }
  try {
    const userRef = db.collection('users').doc(String(userId));
    await userRef.set(data, { merge });
    console.log(`User ${userId} updated/created in Firestore.`);
  } catch (error) {
    console.error(`Error updating user ${userId} in Firestore:`, error);
  }
};

/**
 * Retrieves the admin configuration from Firestore.
 * @returns {Promise<admin.firestore.DocumentSnapshot | null>} The admin config document snapshot or null if not found or db not available.
 */
module.exports.getAdminConfig = async () => {
  if (!db) {
    console.warn('Firestore is not available. Cannot get admin config.');
    return null;
  }
  try {
    const configRef = db.collection('config').doc('admin');
    const doc = await configRef.get();
    return doc;
  } catch (error) {
    console.error('Error getting admin config from Firestore:', error);
    return null;
  }
};

/**
 * Sets the admin ID in Firestore.
 * @param {number} adminId - The Telegram user ID of the admin.
 * @returns {Promise<void | null>} A promise that resolves when the write is complete, or null if db not available.
 */
module.exports.setAdminId = async (adminId) => {
  if (!db) {
    console.warn('Firestore is not available. Cannot set admin ID.');
    return null;
  }
  try {
    const configRef = db.collection('config').doc('admin');
    await configRef.set({ adminId: adminId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log(`Admin ID ${adminId} set in Firestore.`);
  } catch (error) {
    console.error('Error setting admin ID in Firestore:', error);
  }
};

// You can add more Firestore interaction functions here as needed
// e.g., for channels, schools, etc.

/**
 * Adds a channel to the forced join list in Firestore.
 * @param {string} channelId - The ID of the channel.
 * @param {string} channelLink - The invite link of the channel.
 * @param {string} buttonText - The text for the inline button.
 * @returns {Promise<void | null>}
 */
module.exports.addChannel = async (channelId, channelLink, buttonText) => {
    if (!db) {
        console.warn('Firestore is not available. Cannot add channel.');
        return null;
    }
    try {
        const channelRef = db.collection('channels').doc(String(channelId));
        await channelRef.set({
            channelId: String(channelId),
            link: channelLink,
            text: buttonText,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Channel ${channelId} added to Firestore.`);
    } catch (error) {
        console.error(`Error adding channel ${channelId} to Firestore:`, error);
    }
};

/**
 * Gets all forced join channels from Firestore.
 * @returns {Promise<Array<object> | null>} An array of channel objects or null.
 */
module.exports.getChannels = async () => {
    if (!db) {
        console.warn('Firestore is not available. Cannot get channels.');
        return null;
    }
    try {
        const channelsSnapshot = await db.collection('channels').get();
        if (channelsSnapshot.empty) {
            return [];
        }
        return channelsSnapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error getting channels from Firestore:', error);
        return null;
    }
};

/**
 * Adds schools to a specific city and province in Firestore.
 * @param {string} province - The name of the province.
 * @param {string} city - The name of the city.
 * @param {Array<string>} schoolNames - An array of school names.
 * @returns {Promise<void | null>}
 */
module.exports.addSchools = async (province, city, schoolNames) => {
    if (!db) {
        console.warn('Firestore is not available. Cannot add schools.');
        return null;
    }
    try {
        // It's better to use normalized IDs if province/city names can have special characters or case variations
        // For simplicity, using names directly here.
        const cityRef = db.collection('schools').doc(province).collection('cities').doc(city);
        // Using FieldValue.arrayUnion to add new schools without duplicating existing ones,
        // or set directly if you want to overwrite.
        // For this project, overwriting or managing the list carefully might be better.
        // Let's assume we are setting the list directly for now, or appending.
        // If appending, it's good to fetch first and then merge, or use arrayUnion.
        await cityRef.set({
            schoolNames: admin.firestore.FieldValue.arrayUnion(...schoolNames),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // merge:true ensures we don't overwrite other potential fields in the city document
        console.log(`Schools added/updated for ${city}, ${province} in Firestore.`);
    } catch (error) {
        console.error(`Error adding schools for ${city}, ${province} in Firestore:`, error);
    }
};

/**
 * Adds or updates a chat where the bot is an administrator.
 * @param {number} chatId - The ID of the chat.
 * @param {string} title - The title of the chat.
 * @param {string} type - The type of the chat (e.g., 'channel', 'supergroup').
 * @param {string|null} inviteLink - Optional invite link.
 * @returns {Promise<void|null>}
 */
module.exports.updateBotAdministeredChat = async (chatId, title, type, inviteLink = null) => {
    if (!db) {
        console.warn('Firestore is not available. Cannot update bot administered chat.');
        return null;
    }
    try {
        const chatRef = db.collection('bot_administered_chats').doc(String(chatId));
        await chatRef.set({
            chatId: String(chatId),
            title: title,
            type: type,
            inviteLink: inviteLink, // May need to be updated periodically if it expires
            lastUpdated: FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`Bot administered chat ${chatId} (${title}) updated in Firestore.`);
    } catch (error) {
        console.error(`Error updating bot administered chat ${chatId} in Firestore:`, error);
    }
};

/**
 * Removes a chat from the bot_administered_chats collection.
 * @param {number} chatId - The ID of the chat.
 * @returns {Promise<void|null>}
 */
module.exports.removeBotAdministeredChat = async (chatId) => {
    if (!db) {
        console.warn('Firestore is not available. Cannot remove bot administered chat.');
        return null;
    }
    try {
        const chatRef = db.collection('bot_administered_chats').doc(String(chatId));
        await chatRef.delete();
        console.log(`Bot administered chat ${chatId} removed from Firestore.`);
    } catch (error) {
        console.error(`Error removing bot administered chat ${chatId} from Firestore:`, error);
    }
};

/**
 * Gets all chats where the bot is an administrator.
 * @returns {Promise<Array<object>|null>} An array of chat objects or null.
 */
module.exports.getBotAdministeredChats = async () => {
    if (!db) {
        console.warn('Firestore is not available. Cannot get bot administered chats.');
        return null;
    }
    try {
        const chatsSnapshot = await db.collection('bot_administered_chats').orderBy('title').get();
        if (chatsSnapshot.empty) {
            return [];
        }
        return chatsSnapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error getting bot administered chats from Firestore:', error);
        return null;
    }
};


/**
 * Gets schools for a specific city and province from Firestore.
 * @param {string} province - The name of the province.
 * @param {string} city - The name of the city.
 * @returns {Promise<Array<string> | null>} An array of school names or null.
 */
module.exports.getSchools = async (province, city) => {
    if (!db) {
        console.warn('Firestore is not available. Cannot get schools.');
        return null;
    }
    try {
        const cityRef = db.collection('schools').doc(province).collection('cities').doc(city);
        const doc = await cityRef.get();
        if (!doc.exists) {
            console.log(`No schools found for ${city}, ${province}.`);
            return [];
        }
        return doc.data().schoolNames || [];
    } catch (error) {
        console.error(`Error getting schools for ${city}, ${province} from Firestore:`, error);
        return null;
    }
};
