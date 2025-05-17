#!/bin/bash

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js не установлен. Пожалуйста, установите Node.js"
    exit 1
fi

# Проверка наличия npm
if ! command -v npm &> /dev/null; then
    echo "npm не установлен. Пожалуйста, установите npm"
    exit 1
fi

# Проверка наличия файла конфигурации
if [ ! -f "config.json" ]; then
    echo "Файл конфигурации config.json не найден"
    echo "Пожалуйста, создайте файл config.json на основе примера в README.md"
    exit 1
fi

# Установка зависимостей, если они еще не установлены
if [ ! -d "node_modules" ]; then
    echo "Установка зависимостей..."
    npm install
fi

# Запуск бота
echo "Запуск Solana копитрейдинг бота..."
node src/index.js 