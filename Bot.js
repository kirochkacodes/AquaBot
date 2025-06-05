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

  const commandsDescription = {
    exit: 'Выход из бота',
    закрыть: 'Закрыть люк рядом',
    закрой: 'Закрыть люк рядом',
    слот: 'Найти пустой слот и очистить руку',
    help: 'Показать список доступных команд'
  };

  // Создание Telegram бота
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

  // Более расширенный лог подключения
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
    // Отображаем все чат-сообщения в консоли (для дебага)
    console.log('[Чат]', message.toAnsi());
  });

  // Подавление предупреждений о deprecated entity.objectType и entity.mobType
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  console.warn = function(...args) {
    if (args.some(arg => typeof arg === 'string' && (arg.includes('entity.objectType') || arg.includes('entity.mobType')))) {
      return; // Игнорируем предупреждения
    }
    originalConsoleWarn.apply(console, args);
  };

  console.error = function(...args) {
    if (args.some(arg => typeof arg === 'string' && (arg.includes('entity.objectType') || arg.includes('entity.mobType')))) {
      return; // Игнорируем ошибки
    }
    originalConsoleError.apply(console, args);
  };

  // Также подавляем process warning события
  process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && (warning.message.includes('entity.objectType') || warning.message.includes('entity.mobType'))) {
      return; // Игнорируем предупреждения
    }
    originalConsoleWarn(warning.name, warning.message);
  });

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
          if (block) {
            if (block.name && block.name.toLowerCase().includes('trapdoor')) {
              const distSq = (x + 0.5 - botPos.x) ** 2 + (y + 0.5 - botPos.y) ** 2 + (z + 0.5 - botPos.z) ** 2;
              if (distSq < closestDistanceSquared) {
                closestDistanceSquared = distSq;
                closestTrapdoor = block;
              }
            }
          }
        }
      }
    }

    return closestTrapdoor;
  }

  async function closeTrapdoor() {
    const trapdoor = findTrapdoorNear(bot, 3);
    if (!trapdoor) {
      console.log('! Люк не найден в радиусе 3 блоков.');
      return;
    }

    const mcData = require('minecraft-data')(bot.version);

    let isOpen = false;

    if (trapdoor.state && typeof trapdoor.state.open === 'boolean') {
      isOpen = trapdoor.state.open;
    } else if (trapdoor.metadata !== undefined) {
      isOpen = (trapdoor.metadata & 8) !== 0;
    }

    if (isOpen) {
      try {
        await bot.lookAt(trapdoor.position.offset(0.5, 0.5, 0.5));
        // Уменьшаем задержку для более быстрого закрывания люка
        await bot.activateBlock(trapdoor);
        await sleep(200); // Сокращаем время ожидания после активации до 200 мс
        console.log('✓ Люк успешно закрыт.');
      } catch (err) {
        console.error('! Не удалось закрыть люк:', err.message);
      }
    } else {
      console.log('✓ Люк уже закрыт.');
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Обновленная функция с проверкой bot.currentWindow и повторными попытками для обхода античита
  async function findAndClearHeldSlot() {
    try {
      if (bot.currentWindow && bot.currentWindow.id !== 0) {
        await bot.closeWindow(bot.currentWindow);
        console.log('Закрыло открытое окно, возвращаемся в основной инвентарь');
        await sleep(1000 + Math.floor(Math.random() * 500));
      }

      if (bot.currentWindow && bot.currentWindow.id !== 0) {
        console.log('Открыто не основное окно, прерываю действие.');
        return;
      } else {
        console.log('Текущее окно инвентаря:', bot.currentWindow ? bot.currentWindow.id : 'null');
      }

      const emptySlot = bot.inventory.slots.findIndex(slot => slot === null);
      if (emptySlot === -1) {
        console.log('! Пустых слотов в инвентаре не найдено.');
        return;
      }

      const heldItem = bot.inventory.slots[bot.quickBarSlot + 36];
      if (heldItem) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await bot.tossStack(heldItem);
            console.log('✓ Предмет в руке выброшен: ' + heldItem.name);
            break;
          } catch (err) {
            if (attempt === 3) {
              throw err;
            }
            console.log('Попытка выбросить предмет не удалась, повторяем...', attempt);
            await sleep(1000 + Math.floor(Math.random() * 1000));
          }
        }
      }

      if (emptySlot >= 36 && emptySlot <= 44) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await bot.setQuickBarSlot(emptySlot - 36);
            console.log('✓ Рука теперь пустая, выбран пустой слот: ' + emptySlot);
            break;
          } catch (err) {
            if (attempt === 3) {
              throw err;
            }
            console.log('Попытка переключить слот не удалась, повторяем...', attempt);
            await sleep(1000 + Math.floor(Math.random() * 1000));
          }
        }
      } else {
        console.log('! Пустой слот найден вне хотбара, переключение невозможно');
      }
    } catch (err) {
      console.error('! Ошибка при очистке руки:', err.message);
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) {
      return;
    }
    const msg = message.trim().toLowerCase();
    if (msg.includes('закрыть') || msg.includes('закрой')) {
      console.log('Обнаружена команда закрытия люка');
      closeTrapdoor();
    } else if (msg.includes('слот')) {
      console.log('Обнаружена команда слот - ищем пустой слот и очищаем руку');
      findAndClearHeldSlot();
    }
  });

  rl.on('line', (input) => {
    const command = input.trim().toLowerCase();

    // Отображаем команду в консоли
    console.log('Команда бота:', command);

    switch(command) {
      case '':
        break;
      case 'exit':
        bot.quit();
        process.exit();
        return;
      case 'закрыть':
      case 'закрой':
        closeTrapdoor();
        break;
      case 'слот':
        findAndClearHeldSlot();
        break;
      case 'help':
        console.log('\nДоступные команды бота:');
        for (const [cmd, desc] of Object.entries(commandsDescription)) {
          console.log(` - ${cmd}: ${desc}`);
        }
        console.log('');
        break;
      default:
        bot.chat(input);
    }

    rl.prompt();
  }).on('close', () => {
    bot.quit();
    process.exit();
  });

  process.on('SIGINT', () => {
    console.log('\nЗавершение работы...');
    bot.quit();
    process.exit();
  });

  return bot;
}

createBot();
