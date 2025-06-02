const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');

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
  version: '1.16'
};

const bot = mineflayer.createBot({
  username: config.username,
  host: config.host,
  port: config.port,
  version: config.version,
  skipValidation: true,
  hideErrors: true,
  disableSkinParsing: true
});

console.clear();
console.log('Minecraft Bot v1.0\nПодключаемся к ' + config.host + ':' + config.port + '...\n');

const commandsDescription = {
  exit: 'Выход из бота',
  закрыть: 'Закрыть люк рядом',
  закрой: 'Закрыть люк рядом',
  слот: 'Найти пустой слот и очистить руку',
  help: 'Показать список доступных команд'
};

bot.on('login', () => {
  console.log('✓ Успешное подключение как ' + bot.username + '\n');
  console.log('Доступные команды бота:');
  for (const [cmd, desc] of Object.entries(commandsDescription)) {
    console.log(` - ${cmd}: ${desc}`);
  }
  console.log('');
});

bot.on('end', () => {
  console.log('\n× Отключение от сервера');
  process.exit();
});

bot.on('error', (err) => {
  console.error('\n! Ошибка:', err.message);
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
    return 'Люк не найден в радиусе 3 блоков.';
  }

  let isOpen = false;

  if (trapdoor.state && typeof trapdoor.state.open === 'boolean') {
    isOpen = trapdoor.state.open;
  } else if (trapdoor.metadata !== undefined) {
    isOpen = (trapdoor.metadata & 8) !== 0;
  }

  if (isOpen) {
    try {
      await bot.lookAt(trapdoor.position.offset(0.5, 0.5, 0.5));
      await bot.activateBlock(trapdoor);
      await sleep(200);
      console.log('✓ Люк успешно закрыт.');
      return 'Люк успешно закрыт.';
    } catch (err) {
      console.error('! Не удалось закрыть люк:', err.message);
      return 'Ошибка при закрытии люка: ' + err.message;
    }
  } else {
    console.log('✓ Люк уже закрыт.');
    return 'Люк уже закрыт.';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findAndClearHeldSlot() {
  try {
    if (bot.currentWindow && bot.currentWindow.id !== 0) {
      await bot.closeWindow(bot.currentWindow);
      console.log('Закрыло открытое окно, возвращаемся в основной инвентарь');
      await sleep(1000 + Math.floor(Math.random() * 500));
    }

    if (bot.currentWindow && bot.currentWindow.id !== 0) {
      console.log('Открыто не основное окно, прерываю действие.');
      return 'Открыто не основное окно, действие прервано.';
    } else {
      console.log('Текущее окно инвентаря:', bot.currentWindow ? bot.currentWindow.id : 'null');
    }

    const emptySlot = bot.inventory.slots.findIndex(slot => slot === null);
    if (emptySlot === -1) {
      console.log('! Пустых слотов в инвентаре не найдено.');
      return 'Пустых слотов в инвентаре не найдено.';
    }

    const heldItem = bot.inventory.slots[bot.quickBarSlot + 36];
    if (heldItem) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await bot.tossStack(heldItem);
          console.log('✓ Предмет в руке выброшен: ' + heldItem.name);
          return 'Предмет в руке выброшен: ' + heldItem.name;
        } catch (err) {
          if (attempt === 3) {
            throw err;
          }
          console.log('Попытка выбросить предмет не удалась, повторяем...', attempt);
          await sleep(1000 + Math.floor(Math.random() * 1000));
        }
      }
    } else {
      return 'Рука уже пуста.';
    }

    if (emptySlot >= 36 && emptySlot <= 44) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await bot.setQuickBarSlot(emptySlot - 36);
          console.log('✓ Рука теперь пустая, выбран пустой слот: ' + emptySlot);
          return 'Рука теперь пустая, выбран пустой слот: ' + emptySlot;
        } catch (err) {
          if (attempt === 3) {
            throw err;
          }
          console.log('Попытка переключить слот не удалась, повторяем...', attempt);
          await sleep(1000 + Math.floor(Math.random() * 1000));
        }
      }
    } else {
      return 'Пустой слот найден вне хотбара, переключение невозможно';
    }
  } catch (err) {
    console.error('! Ошибка при очистке руки:', err.message);
    return 'Ошибка при очистке руки: ' + err.message;
  }
}

const app = express();
app.use(bodyParser.json());
const server = http.createServer(app);

app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Управление Minecraft ботом</title>
    <style>
      body { font-family: Arial, sans-serif; background: #202020; color: #eee; text-align: center; padding: 30px; }
      button { font-size: 16px; padding: 12px 24px; margin: 10px; cursor: pointer; border-radius: 6px; border: none; background: #4CAF50; color: white; transition: background 0.3s; }
      button:hover { background: #45a049; }
      #log { margin-top: 40px; background: #333; padding: 15px; border-radius: 8px; height: 200px; overflow-y: auto; text-align: left; font-family: monospace; }
    </style>
  </head>
  <body>
    <h1>Управление Minecraft ботом</h1>
    <button onclick="sendCommand('закрыть')">Закрыть люк</button>
    <button onclick="sendCommand('слот')">Очистить руку</button>
    <button onclick="sendCommand('exit')">Выход</button>
    <div id="log"></div>

    <script>
      async function sendCommand(command) {
        appendLog('> ' + command);
        try {
          const response = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
          });
          const result = await response.text();
          appendLog(result);
        } catch (error) {
          appendLog('Ошибка: ' + error.message);
        }
      }
      function appendLog(text) {
        const log = document.getElementById('log');
        log.innerText += text + '\\n';
        log.scrollTop = log.scrollHeight;
      }
    </script>
  </body>
  </html>
  `);
});

app.post('/api/command', async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).send('Команда не указана');

  const cmd = command.toLowerCase();

  if (cmd === 'закрыть' || cmd === 'закрой') {
    const result = await closeTrapdoor();
    return res.send(result);
  } else if (cmd === 'слот') {
    const result = await findAndClearHeldSlot();
    return res.send(result);
  } else if (cmd === 'exit') {
    bot.quit();
    setTimeout(() => process.exit(), 1000);
    return res.send('Бот завершает работу...');
  } else if (cmd === 'help') {
    let list = 'Доступные команды:\n';
    for (const [c, d] of Object.entries(commandsDescription)) {
      list += `- ${c}: ${d}\n`;
    }
    return res.send(list);
  } else {
    bot.chat(command);
    return res.send('Команда отправлена в чат: ' + command);
  }
});

// Подавление предупреждений (как в оригинальном коде)
process.on('SIGINT', () => {
  console.log('\nЗавершение работы...');
  bot.quit();
  process.exit();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`Веб-сервер запущен на порту \${PORT}\`);
  console.log(`Открой в браузере: http://localhost:\${PORT} для управления ботом`);
});

