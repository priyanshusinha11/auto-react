require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');


const token = process.env.TELEGRAM_BOT_TOKEN;

const channelIds = process.env.CHANNEL_IDS.split(',');

const bot = new TelegramBot(token, { polling: true });

const reactions = ['👍', '❤️', '🔥', '🎉', '👏'];

function getRandomReaction() {
    return reactions[Math.floor(Math.random() * reactions.length)];
}

function isMonitoredChannel(chatId) {
    return channelIds.includes(chatId.toString());
}

async function addReaction(msg) {
    const messageId = msg.message_id;
    const chatId = msg.chat.id;
    const delay = Math.floor(Math.random() * 3000) + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const options = {
        form: {
            chat_id: chatId,
            message_id: messageId,
            reaction: JSON.stringify([
                {
                    type: 'emoji',
                    emoji: getRandomReaction()
                }
            ]),
            is_big: false
        }
    };

    try {
        const url = `https://api.telegram.org/bot${token}/setMessageReaction`;
        const response = await bot._request('setMessageReaction', options);
        console.log(`Successfully added reaction to message ${messageId} in channel ${msg.chat.title}`, response);
    } catch (reactionError) {
        console.log('Options sent:', JSON.stringify(options.form, null, 2));
        console.error(`Error adding reaction in channel ${msg.chat.title}:`, reactionError.message);

        try {
            await bot.setMessageReaction({
                chat_id: String(chatId),
                message_id: messageId,
                reaction: [{
                    type: 'emoji',
                    emoji: getRandomReaction()
                }]
            });
            console.log(`Successfully added reaction using alternative method to message ${messageId} in channel ${msg.chat.title}`);
        } catch (altError) {
            console.error(`Alternative method error in channel ${msg.chat.title}:`, altError.message);
        }
    }
}

bot.on('channel_post', async (msg) => {
    try {
        if (isMonitoredChannel(msg.chat.id)) {
            await addReaction(msg);
        }
    } catch (error) {
        console.error(`Error in message handling for channel ${msg.chat.title}:`, error.message);
    }
});

bot.on('channel_post', (msg) => {
    const channelStatus = isMonitoredChannel(msg.chat.id) ? 'monitored' : 'not monitored';
    console.log('Received message:', {
        channelTitle: msg.chat.title,
        channelId: msg.chat.id,
        channelStatus: channelStatus,
        messageId: msg.message_id,
        messageText: msg.text
    });
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
});

console.log(`Bot is running... Monitoring ${channelIds.length} channels`);