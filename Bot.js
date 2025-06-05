const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const readline = require('readline');
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

// Настройки бота
const config = {
  username: 'kirochkacode',
  host: 'mc.mineblaze.net',
  port: 25565,
  version: '1.16',
  telegramToken: 'YOUR_TELEGRAM_BOT_TOKEN' // Замените на ваш токен Telegram бота
};

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

const telegramBot = new TelegramBot(config.telegramToken, { polling: true });

// Функция для создания Minecraft бота
function createBot() {
  console.clear();
  console.log('Minecraft Bot v1.0\nПодключаемся к ' + config.host + ':' + config.port + ' (версия ' + config.version + ')...\n');

  const bot = mineflayer.createBot({
    username: config.username,
    host: config.host,
    port: config.port,
    version: config.version,
    skipValidation: true,
    hideErrors: true,
    disableSkinParsing: true
  });

  const commandsDescription = {
    exit: 'Выход из бота',
    закрыть: 'Закрыть люк рядом',
    закрой: 'Закрыть люк рядом',
    слот: 'Найти пустой слот и очистить руку',
    help: 'Показать список доступных команд'
  };

  // Лог подключения
  bot.on('connecting', () => {
    console.log('... Подключаемся к серверу...');
  });

  bot.on('connect', () => {
    console.log('Соединение установлено с сервером.');
  });

  bot.on('login', () => {
    console.log('✓ Успешное подключение как ' + bot.username + '\n');

    // Вывод списка доступных команд при запуске
    console.log('Доступные команды бота:');
    for (const [cmd, desc] of Object.entries(commandsDescription)) {
      console.log(` - ${cmd}: ${desc}`);
    }
    console.log('');
    reconnectAttempts = 0;  // сброс попыток переподключения
  });

  bot.on('spawn', () => {
    console.log('Бот заспаунен на сервере. Координаты: ' + JSON.stringify(bot.entity ? bot.entity.position : 'неизвестны'));
  });

  bot.on('kicked', (reason, loggedIn) => {
    console.error('Бот был кикнут с сервера. Причина: ' + reason + '. Был ли залогинен: ' + loggedIn);
  });

  bot.on('end', () => {
    console.log('× Отключение от сервера');
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`Попытка переподключения #${reconnectAttempts} через 5 секунд...`);
      setTimeout(() => {
        createBot();
      }, 5000);
    } else {
      console.log('Достигнуто максимальное количество попыток переподключения. Завершение работы.');
      process.exit();
    }
  });

  bot.on('error', (err) => {
    console.error('\n! Ошибка:', err.message);
  });

  bot.on('message', (message) => {
    console.log('[Чат]', message.toAnsi());
  });

  // Функция для закрытия люка
  async function closeTrapdoor() {
    const trapdoor = findTrapdoorNear(bot, 3);
    if (!trapdoor) {
      console.log('! Люк не найден в радиусе 3 блоков.');
      return;
    }

    let isOpen = trapdoor.state && typeof trapdoor.state.open === 'boolean' ? trapdoor.state.open : (trapdoor.metadata & 8) !== 0;

    if (isOpen) {
      try {
        await bot.lookAt(trapdoor.position.offset(0.5, 0.5, 0.5));
        await bot.activateBlock(trapdoor);
        console.log('✓ Люк успешно закрыт.');
      } catch (err) {
        console.error('! Не удалось закрыть люк:', err.message);
      }
    } else {
      console.log('✓ Люк уже закрыт.');
    }
  }

  // Функция для поиска люка рядом
  function findTrapdoorNear(bot, radius = 3) {
    const botPos = bot.entity.position;
    const botX = Math.floor(botPos.x);
    const botY = Math.floor(botPos.y);
    const botZ = Math.floor(botPos.z);

    let closestTrapdoor = null;
    let closestDistanceSquared = Infinity;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const x = botX + dx;
          const y = botY + dy;
          const z = botZ + dz;
          const block = bot.blockAt(new Vec3(x, y, z));
          if (block && block.name && block.name.toLowerCase().includes('trapdoor')) {
            const distSq = (x + 0.5 - botPos.x) ** 2 + (y + 0.5 - botPos.y) ** 2 + (z + 0.5 - botPos.z) ** 2;
            if (distSq < closestDistanceSquared) {
              closestDistanceSquared = distSq;
              closestTrapdoor = block;
            }
          }
        }
      }
    }

    return closestTrapdoor;
  }

  // Функция для очистки руки
  async function findAndClearHeldSlot() {
    const emptySlot = bot.inventory.slots.findIndex(slot => slot === null);
    if (emptySlot === -1) {
      console.log('! Пустых слотов в инвентаре не найдено.');
      return;
    }

    const heldItem = bot.inventory.slots[bot.quickBarSlot + 36];
    if (heldItem) {
      try {
        await bot.tossStack(heldItem);
        console.log('✓ Предмет в руке выброшен: ' + heldItem.name);
      } catch (err) {
        console.error('! Ошибка при выбрасывании предмета:', err.message);
      }
    }

    if (emptySlot >= 36 && emptySlot <= 44) {
      await bot.setQuickBarSlot(emptySlot - 36);
      console.log('✓ Рука теперь пустая, выбран пустой слот: ' + emptySlot);
    } else {
      console.log('! Пустой слот найден вне хотбара, переключение невозможно');
    }
  }

  // Обработка команд из Telegram
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

  return bot;
}

// Запуск бота
createBot();

// Обработка завершения работы
process.on('SIGINT', () => {
  console.log('\nЗавершение работы...');
  process.exit();
});
