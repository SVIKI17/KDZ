// config/initDB.js
const sequelize = require('./database');
const { User, Deck, Card } = require('../models/associations');

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к базе данных установлено.');
    
    // Синхронизация моделей с базой данных
    await sequelize.sync({ force: true });
    console.log('✅ Модели синхронизированы с базой данных.');
    
    // Создаем пользователей
    const admin = await User.create({
      username: 'admin',
      email: 'admin@kdz.ru',
      password: 'admin123',
      role: 'admin'
    });
    
    const teacher = await User.create({
      username: 'teacher',
      email: 'teacher@kdz.ru',
      password: 'teacher123',
      role: 'teacher'
    });
    
    const student = await User.create({
      username: 'student',
      email: 'student@kdz.ru',
      password: 'student123',
      role: 'student'
    });
    
    console.log('✅ Пользователи созданы.');
    
    // Создаем публичную колоду от преподавателя 
    const biologyDeck = await Deck.create({
      id: 1, 
      name: 'Биология: Основные понятия',
      description: 'Основные термины и понятия биологии для начинающих',
      isPublic: true,
      isPublished: true,
      status: 'approved',
      userId: teacher.id
    });
    
    await Card.bulkCreate([
      {
        question: 'Что такое фотосинтез?',
        answer: 'Процесс преобразования света в химическую энергию растениями',
        deckId: 1,
        tags: '#биология #растения',
        userId: teacher.id
      },
      {
        question: 'Что такое ДНК?',
        answer: 'Деоксирибонуклеиновая кислота - носитель генетической информации',
        deckId: 1,
        tags: '#биология #генетика',
        userId: teacher.id
      },
      {
        question: 'Какие бывают виды клеток?',
        answer: 'Прокариотические (без ядра) и эукариотические (с ядром)',
        deckId: 1,
        tags: '#биология #клетка',
        userId: teacher.id
      }
    ]);
    
    console.log('✅ Публичная колода "Биология" создана с 3 карточками.');
    
    // Создаем приватную колоду от студента
    const privateDeck = await Deck.create({
      id: 2, 
      name: 'Мои личные заметки по химии',
      description: 'Персональная колода для изучения химии',
      isPublic: false,
      isPublished: false,
      status: 'draft',
      userId: student.id
    });
    
    await Card.bulkCreate([
      {
        question: 'Что такое pH?',
        answer: 'Мера кислотности или щелочности раствора',
        deckId: 2,
        tags: '#химия #кислотность',
        userId: student.id
      },
      {
        question: 'Что такое моль?',
        answer: 'Единица измерения количества вещества',
        deckId: 2,
        tags: '#химия #единицы',
        userId: student.id
      }
    ]);
    
    console.log('✅ Приватная колода студента создана с 2 карточками.');
    
    console.log('\n👥 Тестовые пользователи:');
    console.log('   Администратор: admin@kdz.ru / admin123');
    console.log('   Преподаватель: teacher@kdz.ru / teacher123');
    console.log('   Студент: student@kdz.ru / student123');
    
    console.log('\n📚 Тестовые колоды:');
    console.log('   Публичная колода ID 1: "Биология" (доступна всем)');
    console.log('   Приватная колода ID 2: "Химия" (только для студента)');
    
  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error);
  }
};

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;