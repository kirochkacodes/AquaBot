const mineflayer = require('mineflayer');
const TelegramBot = require('node-telegram-bot-api');

// Замените 'YOUR_TELEGRAM_BOT_TOKEN' на токен вашего Telegram бота
const telegramBotToken = '7192022070:AAEtcUnInNIcttBqF_35LtY-A78wyITomAY';
const telegramBot = new TelegramBot(telegramBotToken, { polling: true });

// Создание бота Minecraft
const bot = mineflayer.createBot({
    host: 'localhost', // Замените на адрес вашего сервера
    port: 25565,       // Замените на порт вашего сервера
    username: 'Bot',   // Имя пользователя бота
    version: '1.16.4'  // Замените на версию вашего сервера
});

// Обработка сообщений от Telegram
telegramBot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const command = msg.text.trim().toLowerCase();

    switch (command) {
        case '/start':
            telegramBot.sendMessage(chatId, 'Бот запущен! Используйте команды: /close, /slot, /help');
            break;
        case '/close':
            closeTrapdoor().then(() => {
                telegramBot.sendMessage(chatId, 'Люк закрыт.');
            }).catch(err => {
                telegramBot.sendMessage(chatId, 'Ошибка при закрытии люка: ' + err.message);
            });
            break;
        case '/slot':
            findAndClearHeldSlot().then(() => {
                telegramBot.sendMessage(chatId, 'Рука очищена.');
            }).catch(err => {
                telegramBot.sendMessage(chatId, 'Ошибка при очистке руки: ' + err.message);
            });
            break;
        case '/help':
            telegramBot.sendMessage(chatId, 'Доступные команды: /close, /slot');
            break;
        default:
            telegramBot.sendMessage(chatId, 'Неизвестная команда. Используйте /help для списка команд.');
    }
});

// Обработка событий от Minecraft
bot.on('spawn', () => {
    console.log('Бот запущен и подключен к серверу Minecraft.');
});

bot.on('error', (err) => {
    console.error('Ошибка бота:', err);
});

bot.on('message', (json) => {
    try {
        if (json && typeof json === 'object' && 'text' in json) {
            console.log('Сообщение от сервера:', json.text);
        } else {
            console.warn('Получены некорректные данные:', json);
        }
    } catch (error) {
        console.error('Произошла ошибка при обработке сообщения:', error);
    }
});

// Пример функции для закрытия люка
async function closeTrapdoor() {
    // Ваш код для закрытия люка
}

// Пример функции для очистки руки
async function findAndClearHeldSlot() {
    // Ваш код для очистки руки
}
