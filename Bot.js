const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const fetch = require('node-fetch');

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
    console.log(' - ' + cmd + ': ' + desc);
  }
  console.log('');
});

// Отображаем чат сервера в консоль (кроме сообщений от самого бота)
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  console.log(`[${username}]: ${message}`);
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

// Подавление process warning событий
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && (warning.message.includes('entity.objectType') || warning.message.includes('entity.mobType'))) {
    return; // Игнорируем предупреждения
  }
  originalConsoleWarn(warning.name, warning.message);
});

// Функции findTrapdoorNear, closeTrapdoor, findAndClearHeldSlot, sleep остаются без изменений

const app = express();
app.use(bodyParser.json());
const server = http.createServer(app);

app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>Управление Minecraft ботом</title>
    <style>
      body { font-family: Arial, sans-serif; background: #202020; color: #eee; text-align: center; padding: 30px; }
      button { font-size: 16px; padding: 12px 24px; margin: 10px; cursor: pointer; border-radius: 6px; border: none; background: #4CAF50; color: white; transition: background 0.3s; }
      button:hover { background: #45a049; }
      #log { margin-top: 40px; background: #333; padding: 15px; border-radius: 8px; height: 200px; overflow-y: auto; text-align: left; font-family: monospace; white-space: pre-wrap; }
      #commandForm { margin-top: 20px; }
      #commandInput { width: 60%; padding: 10px; font-size: 16px; border-radius: 6px; border: none; }
      #sendCommandBtn { padding: 10px 20px; font-size: 16px; border-radius: 6px; border: none; background: #2196F3; color: white; cursor: pointer; transition: background 0.3s; }
      #sendCommandBtn:hover { background: #0b7dda; }
    </style>
  </head>
  <body>
    <h1>Управление Minecraft ботом</h1>
    <button onclick="sendCommand('закрыть')">Закрыть люк</button>
    <button onclick="sendCommand('слот')">Очистить руку</button>
    <button onclick="sendCommand('exit')">Выход</button>

    <form id="commandForm" onsubmit="return sendCustomCommand(event)">
      <input id="commandInput" type="text" placeholder="Введите команду или сообщение для бота" autocomplete="off" autofocus />
      <button id="sendCommandBtn" type="submit">Отправить</button>
    </form>

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

      async function sendCustomCommand(event) {
        event.preventDefault();
        const input = document.getElementById('commandInput');
        const command = input.value.trim();
        if (command === '') return false;
        await sendCommand(command);
        input.value = '';
        input.focus();
        return false;
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
      list += '- ' + c + ': ' + d + '\n';
    }
    return res.send(list);
  } else {
    bot.chat(command);
    return res.send('Команда отправлена в чат: ' + command);
  }
});

// Функция для периодического пинга, чтобы не дать Render уснуть
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || 'http://localhost:' + (process.env.PORT || 25565);
const KEEP_ALIVE_INTERVAL = 30 * 1000; // 30 секунд

function keepAlive() {
  fetch(KEEP_ALIVE_URL)
    .then(() => console.log(`Пинг успешен: ${new Date().toLocaleTimeString()}`))
    .catch(err => console.error(`Ошибка пинга: ${err.message}`));
}

setInterval(keepAlive, KEEP_ALIVE_INTERVAL);

process.on('SIGINT', () => {
  console.log('\nЗавершение работы...');
  bot.quit();
  process.exit();
});

const PORT = process.env.PORT || 25565;
server.listen(PORT, () => {
  console.log(`Веб-сервер запущен на порту ${PORT}`);
  console.log(`Открой в браузере: http://your-render-domain/ (без указания порта)`);
});
