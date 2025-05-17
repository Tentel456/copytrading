import { 
  PublicKey, 
  Transaction, 
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

/**
 * Анализирует транзакцию и создает аналогичную для копирования
 * @param {Object} txDetails - Детали исходной транзакции
 * @param {Connection} connection - Соединение с Solana
 * @param {Keypair} userWallet - Кошелек пользователя
 * @param {Number} slippageTolerance - Допустимое проскальзывание в процентах
 * @returns {Promise<string|null>} - Сигнатура транзакции или null в случае ошибки
 */
export async function replicateTransaction(txDetails, connection, userWallet, slippageTolerance = 0.5) {
  try {
    if (!txDetails || !txDetails.transaction || !txDetails.transaction.message) {
      console.error('Неверный формат деталей транзакции');
      return null;
    }

    const instructions = txDetails.transaction.message.instructions;
    const recentBlockhash = await connection.getLatestBlockhash();
    
    // Создаем новую транзакцию
    const newTx = new Transaction({
      feePayer: userWallet.publicKey,
      recentBlockhash: recentBlockhash.blockhash
    });
    
    // Анализируем инструкции исходной транзакции
    for (const instruction of instructions) {
      // Обрабатываем только известные программы
      if (instruction.programId) {
        const programId = new PublicKey(instruction.programId);
        
        // Обработка переводов SOL
        if (programId.equals(SystemProgram.programId)) {
          if (instruction.parsed && instruction.parsed.type === 'transfer') {
            const { info } = instruction.parsed;
            
            // Создаем аналогичный перевод
            const transferInstruction = SystemProgram.transfer({
              fromPubkey: userWallet.publicKey,
              toPubkey: new PublicKey(info.destination),
              lamports: Math.floor(info.lamports)
            });
            
            newTx.add(transferInstruction);
            console.log(`Добавлена инструкция перевода ${info.lamports / LAMPORTS_PER_SOL} SOL на ${info.destination}`);
          }
        }
        // Здесь можно добавить обработку других типов транзакций (свапы, стейкинг и т.д.)
      }
    }
    
    // Проверяем, что у нас есть хотя бы одна инструкция
    if (newTx.instructions.length === 0) {
      console.log('Не удалось создать инструкции для копирования');
      return null;
    }
    
    // Отправляем транзакцию
    console.log('Отправка копирующей транзакции...');
    const signature = await sendAndConfirmTransaction(
      connection,
      newTx,
      [userWallet]
    );
    
    console.log(`Транзакция успешно отправлена: ${signature}`);
    return signature;
    
  } catch (error) {
    console.error('Ошибка при репликации транзакции:', error);
    return null;
  }
}

/**
 * Проверяет баланс кошелька
 * @param {Connection} connection - Соединение с Solana
 * @param {PublicKey} publicKey - Публичный ключ кошелька
 * @returns {Promise<number>} - Баланс в SOL
 */
export async function checkBalance(connection, publicKey) {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Ошибка при проверке баланса:', error);
    return 0;
  }
} 