require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

class TelegramChannelBot {
    constructor(config) {
        this.tokens = this.parseTokens(config.botTokens);
        this.channelIds = this.parseChannelIds(config.channelIds);
        this.reactions = config.reactions || ['👍', '❤️', '🔥', '🎉', '👏'];
        this.bots = new Map();
        this.initializeBots();
    }

    parseTokens(tokenString) {
        if (!tokenString) {
            throw new Error('Bot tokens are required');
        }
        return tokenString.split(',').map(token => token.trim()).filter(token => token);
    }

    parseChannelIds(channelString) {
        if (!channelString) {
            throw new Error('Channel IDs are required');
        }
        return channelString.split(',').map(id => id.trim()).filter(id => id);
    }

    initializeBots() {
        this.tokens.forEach((token, index) => {
            try {
                const bot = new TelegramBot(token, {
                    polling: {
                        params: {
                            timeout: 50,
                            allowed_updates: ['channel_post']
                        }
                    }
                });

                this.setupEventHandlers(bot, token);
                this.bots.set(token, bot);
                console.log(`Bot ${index + 1} (${this.maskToken(token)}) initialized successfully`);
            } catch (error) {
                console.error(`Failed to initialize bot ${index + 1} (${this.maskToken(token)}):`, error.message);
            }
        });
    }

    setupEventHandlers(bot, token) {
        bot.on('channel_post', async (msg) => {
            try {
                if (this.isMonitoredChannel(msg.chat.id)) {
                    await this.logMessage(token, msg);
                    await this.handleReaction(bot, token, msg);
                }
            } catch (error) {
                console.error(`Bot ${this.maskToken(token)} error in message handling:`, error.message);
            }
        });

        bot.on('polling_error', (error) => {
            if (error.code === 401) {
                console.error(`Bot ${this.maskToken(token)} is unauthorized. Please check the token.`);
                this.removeBot(token);
            } else if (error.message.includes('ETELEGRAM: 409 Conflict')) {
                this.handlePollingConflict(bot, token);
            } else {
                console.error(`Bot ${this.maskToken(token)} polling error:`, error.message);
            }
        });
    }

    removeBot(token) {
        const bot = this.bots.get(token);
        if (bot) {
            bot.stopPolling();
            this.bots.delete(token);
            console.log(`Bot ${this.maskToken(token)} has been removed due to authorization failure`);
        }
    }

    async handlePollingConflict(bot, token) {
        try {
            await bot.stopPolling();
            console.log(`Bot ${this.maskToken(token)} stopped polling due to conflict`);

            const delay = Math.floor(Math.random() * 5000) + 2000;
            await new Promise(resolve => setTimeout(resolve, delay));

            await bot.startPolling({
                restart: true,
                polling_options: {
                    timeout: 50,
                    allowed_updates: ['channel_post']
                }
            });
            console.log(`Bot ${this.maskToken(token)} successfully restarted polling`);
        } catch (error) {
            console.error(`Bot ${this.maskToken(token)} restart error:`, error.message);
        }
    }

    async handleReaction(bot, token, msg) {
        const messageId = msg.message_id;
        const chatId = msg.chat.id;
        const delay = Math.floor(Math.random() * 3000) + 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        const reaction = {
            chat_id: chatId,
            message_id: messageId,
            reaction: [{
                type: 'emoji',
                emoji: this.getRandomReaction()
            }]
        };

        try {
            // First attempt using raw API request
            await bot._request('setMessageReaction', {
                form: {
                    chat_id: chatId,
                    message_id: messageId,
                    reaction: JSON.stringify(reaction.reaction)
                }
            });
            console.log(`Bot ${this.maskToken(token)} added reaction to message ${messageId} in ${msg.chat.title}`);
        } catch (error) {
            console.error(`Bot ${this.maskToken(token)} reaction error:`, error.message);

            // If the first attempt fails, try with a delay and different format
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await bot._request('setMessageReaction', {
                    json: true,
                    form: {
                        chat_id: chatId,
                        message_id: messageId,
                        reaction: JSON.stringify([{
                            type: 'emoji',
                            emoji: this.getRandomReaction()
                        }])
                    }
                });
                console.log(`Bot ${this.maskToken(token)} added reaction (retry) to message ${messageId}`);
            } catch (retryError) {
                console.error(`Bot ${this.maskToken(token)} retry failed:`, retryError.message);
            }
        }
    }

    logMessage(token, msg) {
        console.log('Received message:', {
            botToken: this.maskToken(token),
            channelTitle: msg.chat.title,
            channelId: msg.chat.id,
            channelStatus: this.isMonitoredChannel(msg.chat.id) ? 'monitored' : 'not monitored',
            messageId: msg.message_id,
            messageText: msg.text
        });
    }

    isMonitoredChannel(chatId) {
        return this.channelIds.includes(chatId.toString());
    }

    getRandomReaction() {
        return this.reactions[Math.floor(Math.random() * this.reactions.length)];
    }

    maskToken(token) {
        return token.slice(0, 10) + '...';
    }

    shutdown() {
        this.bots.forEach(bot => bot.stopPolling());
    }

    getActiveBotCount() {
        return this.bots.size;
    }
}

const config = {
    botTokens: process.env.BOT_TOKENS,
    channelIds: process.env.CHANNEL_IDS
};

const channelBot = new TelegramChannelBot(config);

process.on('SIGINT', () => {
    console.log('Shutting down bots...');
    channelBot.shutdown();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    channelBot.shutdown();
    process.exit(1);
});

console.log(`Running ${channelBot.getActiveBotCount()} bots, monitoring ${channelBot.channelIds.length} channels`);