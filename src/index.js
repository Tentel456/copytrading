import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import fs from 'fs';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { replicateTransaction, checkBalance } from './transactionHelper.js';

// Загрузка конфигурации
dotenv.config();
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Инициализация соединения с блокчейном
const connection = new Connection(config.rpcEndpoint, 'confirmed');

// Инициализация кошелька пользователя из приватного ключа
const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY || config.privateKey);
const userWallet = Keypair.fromSecretKey(privateKeyBytes);

// Проверяем баланс кошелька
async function init() {
  const balance = await checkBalance(connection, userWallet.publicKey);
  
  console.log(`Бот запущен. Отслеживаем кошельки: ${config.wallets.join(', ')}`);
  console.log(`Ваш адрес: ${userWallet.publicKey.toString()}`);
  console.log(`Текущий баланс: ${balance} SOL`);
  
  if (balance < 0.01) {
    console.warn('Внимание: баланс очень низкий, может не хватить на комиссии');
  }
  
  // Запускаем мониторинг после инициализации
  monitorWallets();
}

// Преобразование адресов в объекты PublicKey
const walletsToCopy = config.wallets.map(address => new PublicKey(address));

// Отслеживание последнего обработанного слота для каждого кошелька
const lastProcessedSlots = {};
walletsToCopy.forEach(wallet => {
  lastProcessedSlots[wallet.toString()] = 0;
});

// Функция для копирования транзакции
async function copyTransaction(originalTx, slot) {
  try {
    console.log(`Копирование транзакции из слота ${slot}...`);
    
    // Получаем детали транзакции
    const txDetails = await connection.getParsedTransaction(originalTx, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (!txDetails) {
      console.log('Не удалось получить детали транзакции');
      return;
    }
    
    // Используем нашу функцию для репликации транзакции
    const signature = await replicateTransaction(
      txDetails, 
      connection, 
      userWallet, 
      config.slippageTolerance
    );
    
    if (signature) {
      console.log(`Транзакция успешно скопирована, сигнатура: ${signature}`);
    } else {
      console.log('Не удалось скопировать транзакцию');
    }
  } catch (error) {
    console.error('Ошибка при копировании транзакции:', error);
  }
}

// Основная функция для отслеживания транзакций
async function monitorWallets() {
  try {
    // Получаем текущий слот
    const currentSlot = await connection.getSlot();
    
    // Проверяем каждый кошелек
    for (const wallet of walletsToCopy) {
      const walletAddress = wallet.toString();
      
      // Инициализируем последний обработанный слот, если это первый запуск
      if (lastProcessedSlots[walletAddress] === 0) {
        lastProcessedSlots[walletAddress] = currentSlot - 1;
        console.log(`Инициализация отслеживания для ${walletAddress} с слота ${lastProcessedSlots[walletAddress]}`);
        continue;
      }
      
      // Получаем подписанные транзакции для кошелька начиная с последнего обработанного слота
      const signatures = await connection.getSignaturesForAddress(wallet, {
        limit: 10,
        until: lastProcessedSlots[walletAddress]
      });
      
      // Обрабатываем новые транзакции (в обратном порядке, чтобы сначала обрабатывать более старые)
      for (let i = signatures.length - 1; i >= 0; i--) {
        const sig = signatures[i];
        
        // Пропускаем уже обработанные транзакции
        if (sig.slot <= lastProcessedSlots[walletAddress]) continue;
        
        console.log(`Обнаружена новая транзакция от ${walletAddress} в слоте ${sig.slot}`);
        
        // Копируем транзакцию
        await copyTransaction(sig.signature, sig.slot);
        
        // Обновляем последний обработанный слот
        lastProcessedSlots[walletAddress] = sig.slot;
      }
    }
  } catch (error) {
    console.error('Ошибка при мониторинге кошельков:', error);
  }
  
  // Запускаем следующую итерацию через 2 секунды
  setTimeout(monitorWallets, 2000);
}

// Запуск бота
init(); 