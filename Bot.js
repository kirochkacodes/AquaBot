const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const TelegramBot = require('node-telegram-bot-api');
const originalParse = JSON.parse;

// Переопределяем JSON.parse для исправления ошибок парсинга с текстурами
JSON.parse = function(text) {
  try {
    return originalParse(text);
  } catch (e) {
    if (text.includes('textures') && text.includes('SKIN')) {
      try {
        const fixedText = text.replace(/'/g, '"').replace(/\\/g, '');
        return originalParse(fixedText);
      } catch (e2) {
        return { textures: { SKIN: { url: '' } } };
      }
    }
    throw e;
  }
};

const config = {
  username: 'kirochkacode',
  host: 'mc.mineblaze.net',
  port: 25565,
  version: '1.16',
  telegramToken: '7192022070:AAEtcUnInNIcttBqF_35LtY-A78wyITomAY' // Замените на токен вашего Telegram бота
};

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let bot; // Объявляем переменную для бота

function createBot() {
  console.clear();
  console.log('Minecraft Bot v1.0\nПодключаемся к ' + config.host + ':' + config.port + ' (версия ' + config.version + ')...\n');

  bot = mineflayer.createBot({
    username: config.username,
    host: config.host,
    port: config.port,
    version: config.version,
    skipValidation: true,
    hideErrors: true,
    disableSkinParsing: true
  });

  const telegramBot = new TelegramBot(config.telegramToken, { polling: true });

  // Обработка команд от Telegram
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

  // Остальная часть вашего кода...
}

createBot();
