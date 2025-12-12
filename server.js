// server.js 
const { Op } = require('sequelize');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const sequelize = require('./config/database');

// Импортируем модели
const { User, Deck, Card, StudySession, UserCardProgress } = require('./models/associations');
const app = express();
const PORT = process.env.PORT || 3000;

// проверка доступности моделей
console.log('=== ПРОВЕРКА МОДЕЛЕЙ ===');
console.log('User доступен?', typeof User !== 'undefined');
console.log('Deck доступен?', typeof Deck !== 'undefined');
console.log('Card доступен?', typeof Card !== 'undefined');
console.log('StudySession доступен?', typeof StudySession !== 'undefined');
console.log('UserCardProgress доступен?', typeof UserCardProgress !== 'undefined');
console.log('Op доступен?', typeof Op !== 'undefined');
console.log('========================');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({
  secret: 'kdz-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    console.log('[AUTH] Пользователь не аутентифицирован');
    return res.redirect('/login');
  }
  
  req.userId = req.session.user.id;
  console.log('[AUTH] Пользователь аутентифицирован:', {
    id: req.session.user.id,
    email: req.session.user.email,
    role: req.session.user.role
  });
  
  next();
};

// Проверка роли администратора 
const requireAdmin = (req, res, next) => {
    if (!req.session.user) {
        const isAjaxRequest = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';
        if (isAjaxRequest) {
            return res.status(401).json({ 
                success: false, 
                error: 'Требуется авторизация' 
            });
        }
        return res.redirect('/login');
    }
    
    if (req.session.user.role !== 'admin') {
        const isAjaxRequest = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';
        if (isAjaxRequest) {
            return res.status(403).json({ 
                success: false, 
                error: 'Доступ запрещен. Требуются права администратора.' 
            });
        }
        return res.status(403).send('Доступ запрещен. Требуются права администратора.');
    }
    
    next();
};




async function checkStudySessionTable() {
  try {
    // Проверяем, существует ли таблица StudySession
    const tableExists = await sequelize.getQueryInterface().tableExists('StudySessions');
    
    if (!tableExists) {
      console.log('📊 Таблица StudySessions не существует, создаем...');
      await StudySession.sync();
      console.log('✅ Таблица StudySessions создана');
    } else {
      console.log('✅ Таблица StudySessions существует');
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке таблицы StudySessions:', error);
  }
}

// Главная страница
app.get('/', async (req, res) => {
    console.log('[DEBUG] Запрос главной страницы');
    
    try {
        let stats = {
            totalUsers: 0,
            totalDecks: 0,
            totalCards: 0,
            totalSessions: 0,
            publicDecks: []
        };
        
        try {
            stats.totalUsers = await User.count();
            stats.totalDecks = await Deck.count();
            stats.totalCards = await Card.count();
            stats.totalSessions = await StudySession.count();
            
           
            stats.publicDecks = await Deck.findAll({
                where: {
                    isPublic: true,
                    status: 'approved'
                },
                include: [{
                    model: User,
                    attributes: ['id', 'username'] 
                }],
                limit: 6,
                order: [['createdAt', 'DESC']]
            });
            
            console.log('[DEBUG] Статистика загружена:', {
                users: stats.totalUsers,
                decks: stats.totalDecks,
                cards: stats.totalCards,
                sessions: stats.totalSessions,
                publicDecks: stats.publicDecks.length
            });
            
           
            if (stats.publicDecks.length > 0) {
                console.log('[DEBUG] Первая публичная колода:', {
                    id: stats.publicDecks[0].id,
                    name: stats.publicDecks[0].name,
                    hasUser: !!stats.publicDecks[0].User,
                    userData: stats.publicDecks[0].User
                });
            }
            
        } catch (dbError) {
            console.error('[ERROR] Ошибка БД:', dbError);
            stats.publicDecks = [];
        }
        
        res.render('index', {
            user: req.session.user || null,
            stats: stats,
            topUsers: [],
            userStats: null,
            title: 'Главная страница'
        });
        
    } catch (error) {
        console.error('[ERROR] Критическая ошибка главной страницы:', error);
        res.render('index', {
            user: req.session.user || null,
            stats: {
                totalUsers: 3,
                totalDecks: 2,
                totalCards: 7,
                totalSessions: 0,
                publicDecks: []
            },
            topUsers: [],
            userStats: null,
            title: 'Главная страница'
        });
    }
});

// Отладочный маршрут для проверки сессии
app.get('/api/debug/session', (req, res) => {
  res.json({
    session: req.session,
    user: req.session.user,
    cookies: req.headers.cookie,
    timestamp: new Date().toISOString()
  });
});
// Отладочный маршрут - все сессии пользователя
app.get('/api/debug/my-sessions', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user?.id || req.userId;
        const sessions = await StudySession.findAll({
            where: { userId },
            include: [Deck],
            order: [['createdAt', 'DESC']]
        });
        
        res.json({
            success: true,
            userId,
            sessionsCount: sessions.length,
            sessions: sessions.map(s => ({
                id: s.id,
                deckId: s.deckId,
                deckTitle: s.Deck?.title || 'Unknown',
                correctCount: s.correctCount,
                wrongCount: s.wrongCount,
                mode: s.mode,
                createdAt: s.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Отладочный маршрут - все сессии в системе
app.get('/api/debug/all-sessions', async (req, res) => {
    try {
        const sessions = await StudySession.findAll({
            include: [
                { model: User, attributes: ['id', 'email', 'name'] },
                { model: Deck, attributes: ['id', 'title'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        
        res.json({
            success: true,
            totalSessions: await StudySession.count(),
            sessions: sessions
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});



// Маршруты для аутентификации
app.get('/login', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    }
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { title: 'Вход в систему' });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.render('auth/login', { 
        error: 'Неверный email или пароль' 
      });
    }
    
    const isValidPassword = await user.validPassword(password);
    
    if (!isValidPassword) {
      return res.render('auth/login', { 
        error: 'Неверный email или пароль' 
      });
    }
    
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    if (user.role === 'admin') {
      return res.redirect('/admin');
    }
    return res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/register', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    }
    return res.redirect('/dashboard');
  }
  res.render('auth/register', { title: 'Регистрация' });
});

app.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.render('auth/register', { 
        error: 'Пароли не совпадают' 
      });
    }
    
    // Проверка существования пользователя по email
    const existingUserByEmail = await User.findOne({ 
      where: { email } 
    });
    
    if (existingUserByEmail) {
      return res.render('auth/register', { 
        error: 'Данная почта уже зарегистрирована' 
      });
    }
    
    // Проверка существования пользователя по username
    const existingUserByUsername = await User.findOne({ 
      where: { username } 
    });
    
    if (existingUserByUsername) {
      return res.render('auth/register', { 
        error: 'Данное имя пользователя занято' 
      });
    }
    
    const user = await User.create({
      username,
      email,
      password,
      role: 'student'
    });
    
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.render('auth/register', { 
      error: 'Ошибка при регистрации' 
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Личный кабинет 
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    }
    
    const userDecks = await Deck.findAll({
      where: { userId: req.session.user.id },
      include: [{
        model: Card,
        attributes: ['id']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    const publicDecks = await Deck.findAll({
      where: { 
        isPublic: true, 
        isPublished: true,
        status: 'approved' 
      },
      include: [
        {
          model: User,
          attributes: ['username']
        },
        {
          model: Card,
          attributes: ['id']
        }
      ],
      limit: 10,
      order: [['createdAt', 'DESC']]
    });
    
    const totalPublicCards = publicDecks.reduce((total, deck) => {
      return total + (deck.Cards ? deck.Cards.length : 0);
    }, 0);
    
    res.render('dashboard', {
      title: 'Личный кабинет',
      userDecks,
      publicDecks,
      totalPublicCards
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});





// Создание карточки
app.get('/cards/create', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    }
    
    const userDecks = await Deck.findAll({
      where: { userId: req.session.user.id }
    });
    
    const deckIdFromQuery = req.query.deckId;
    
    res.render('cards/create', {
      title: 'Создание карточки',
      decks: userDecks,
      selectedDeckId: deckIdFromQuery || '' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

app.post('/cards', requireAuth, async (req, res) => {
  try {
    // Проверяем, является ли пользователь администратором
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    }
    
    const { question, answer, deckId, tags } = req.body;
    
    const deck = await Deck.findOne({
      where: {
        id: deckId,
        userId: req.session.user.id
      }
    });
    
    if (!deck) {
      return res.status(403).send('Вы не можете добавить карточку в эту колоду');
    }
    
    await Card.create({
      question,
      answer,
      deckId,
      tags,
      userId: req.session.user.id
    });
    
    res.redirect(`/decks/${deckId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка при создании карточки');
  }
});

// Просмотр отдельной карточки
app.get('/cards/:id', async (req, res) => {
  try {
    const card = await Card.findByPk(req.params.id, {
      include: [{
        model: Deck,
        include: [{
          model: User,
          attributes: ['username', 'id']
        }]
      }]
    });
    
    if (!card) {
      return res.status(404).send('Карточка не найдена');
    }
    
    // Проверка доступа
    if (!card.Deck.isPublic && req.session.user?.id !== card.Deck.userId) {
      return res.status(403).send('Доступ запрещен');
    }
    
    res.render('cards/view', {
      title: `Карточка: ${card.question.substring(0, 50)}...`,
      card
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// Редактирование карточки
app.get('/cards/:id/edit', requireAuth, async (req, res) => {
  try {
    const card = await Card.findByPk(req.params.id, {
      include: [{
        model: Deck,
        attributes: ['id', 'userId']
      }]
    });
    
    if (!card) {
      return res.status(404).send('Карточка не найдена');
    }
    
    // Проверка прав доступа
    if (card.Deck.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).send('Доступ запрещен');
    }
    
    const userDecks = await Deck.findAll({
      where: { userId: req.session.user.id }
    });
    
    res.render('cards/edit', {
      title: 'Редактирование карточки',
      card,
      decks: userDecks
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// Обновление карточки
app.put('/cards/:id', requireAuth, async (req, res) => {
  try {
    const card = await Card.findByPk(req.params.id, {
      include: [{
        model: Deck,
        attributes: ['id', 'userId']
      }]
    });
    
    if (!card) {
      return res.status(404).send('Карточка не найдена');
    }
    
    if (card.Deck.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).send('Доступ запрещен');
    }
    
    const { question, answer, deckId, tags } = req.body;
    
    await card.update({
      question,
      answer,
      deckId,
      tags
    });
    
    res.redirect(`/decks/${deckId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка при обновлении карточки');
  }
});

// Удалние карточки
app.delete('/cards/:id', requireAuth, async (req, res) => {
  try {
    const card = await Card.findByPk(req.params.id, {
      include: [{
        model: Deck,
        attributes: ['id', 'userId']
      }]
    });
    
    if (!card) {
      return res.status(404).send('Карточка не найдена');
    }
    
    if (card.Deck.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).send('Доступ запрещен');
    }
    
    const deckId = card.deckId;
    await card.destroy();
    
    res.redirect(`/decks/${deckId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка при удалении карточки');
  }
});

// Создание колоды
app.get('/decks/create', requireAuth, (req, res) => {
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }
  
  res.render('decks/create', {
    title: 'Создание колоды'
  });
});

app.post('/decks', requireAuth, async (req, res) => {
  try {
    // Проверяем, является ли пользователь администратором
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    }
    
    const { name, description, isPublic } = req.body;
    
    await Deck.create({
      name,
      description,
      isPublic: isPublic === 'on',
      userId: req.session.user.id
    });
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка при создании колоды');
  }
});

// Просмотр колоды 
app.get('/decks/:id', async (req, res) => {
  try {
    const deck = await Deck.findByPk(req.params.id, {
      include: [
        {
          model: User,
          attributes: ['username', 'id']
        },
        {
          model: Card
        }
      ]
    });
    
    if (!deck) {
      return res.status(404).send('Колода не найдена');
    }
    
    if (!deck.isPublic && req.session.user?.id !== deck.userId) {
      return res.status(403).send('Доступ запрещен');
    }
    
    res.render('decks/view', {
      title: deck.name,
      deck
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// Редактирование колоды 
app.get('/decks/:id/edit', requireAuth, async (req, res) => {
  try {
    const deck = await Deck.findByPk(req.params.id);
    
    if (!deck) {
      return res.status(404).send('Колода не найдена');
    }
    
    if (deck.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).send('Доступ запрещен');
    }
    
    res.render('decks/edit', {
      title: `Редактирование: ${deck.name}`,
      deck
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// Обновление колоды
app.put('/decks/:id', requireAuth, async (req, res) => {
  try {
    const deck = await Deck.findByPk(req.params.id);
    
    if (!deck) {
      return res.status(404).send('Колода не найдена');
    }
    
    if (deck.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).send('Доступ запрещен');
    }
    
    const { name, description, isPublic } = req.body;
    
    await deck.update({
      name,
      description,
      isPublic: isPublic === 'on',
      // Если колода становится публичной, меняем статус на ожидание модерации
      status: isPublic === 'on' ? 'pending' : deck.status
    });
    
    res.redirect(`/decks/${deck.id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка при обновлении колоды');
  }
});

// Удаление колоды
app.delete('/decks/:id', requireAuth, async (req, res) => {
  try {
    const deck = await Deck.findByPk(req.params.id);
    
    if (!deck) {
      return res.status(404).send('Колода не найдена');
    }
    
    if (deck.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).send('Доступ запрещен');
    }
    
    await deck.destroy();
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка при удалении колоды');
  }
});

// Режим обучения 
app.get('/decks/:id/study/swipe', requireAuth, async (req, res) => {
  try {
    const deckId = parseInt(req.params.id);
    const deck = await Deck.findByPk(deckId, {
      include: [{
        model: Card
      }]
    });
    
    if (!deck) {
      return res.status(404).send('Колода не найдена');
    }
    
    // Проверка доступа
    if (deck.userId !== req.session.user.id && !deck.isPublic) {
      return res.status(403).send('Доступ запрещен');
    }
    
    // Проверяем, есть ли карточки
    if (!deck.Cards || deck.Cards.length === 0) {
      return res.render('study/empty', {
        title: `Обучение: ${deck.name}`,
        deck,
        message: 'В этой колоде нет карточек для обучения'
      });
    }
    
    res.render('study/swipe', {
      title: `Обучение: ${deck.name}`,
      deck,
      cards: deck.Cards
    });
  } catch (error) {
    console.error('Ошибка в режиме swipe:', error);
    res.status(500).send('Ошибка сервера');
  }
});

// Режим обучения 
app.get('/decks/:id/study/speed', requireAuth, async (req, res) => {
  try {
    const deckId = parseInt(req.params.id);
    const deck = await Deck.findByPk(deckId, {
      include: [{
        model: Card
      }]
    });
    
    if (!deck) {
      return res.status(404).send('Колода не найдена');
    }
    
    // Проверка доступа
    if (deck.userId !== req.session.user.id && !deck.isPublic) {
      return res.status(403).send('Доступ запрещен');
    }
    
    // Проверяем, есть ли карточки
    if (!deck.Cards || deck.Cards.length === 0) {
      return res.render('study/empty', {
        title: `Скоростной вызов: ${deck.name}`,
        deck,
        message: 'В этой колоде нет карточек для обучения'
      });
    }
    
    res.render('study/speed', {
      title: `Скоростной вызов: ${deck.name}`,
      deck,
      cards: deck.Cards
    });
  } catch (error) {
    console.error('Ошибка в режиме speed:', error);
    res.status(500).send('Ошибка сервера');
  }
});

// Публичная библиотека
app.get('/library', async (req, res) => {
  try {
    const publicDecks = await Deck.findAll({
      where: { 
        isPublic: true, 
        isPublished: true,
        status: 'approved' 
      },
      include: [{
        model: User,
        attributes: ['username']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.render('library/index', {
      title: 'Публичная библиотека',
      decks: publicDecks
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// маршрут сохранения сессии
app.post('/api/study/session', requireAuth, async (req, res) => {
  console.log('[API] Сохранение сессии:', req.body);
  
  try {
    const { 
      deckId, 
      correctCount, 
      wrongCount, 
      studyMode, 
      timeSpent,
     
      correctAnswers,
      totalCards,
      score,
      mode: frontendMode 
    } = req.body;
    
    const userId = req.session.user?.id;
    
    if (!userId) {
      console.error('[ERROR] userId не найден в сессии');
      return res.status(401).json({
        success: false,
        message: 'Пользователь не авторизован'
      });
    }
    
    console.log(`[STUDY] Сохранение сессии пользователя ${userId}`);
    
   
    const mode = frontendMode || studyMode || 'swipe';
    

    const correct = correctCount || correctAnswers || 0;
    const wrong = wrongCount || 0;
    const total = totalCards || (correct + wrong);
    

    const session = await StudySession.create({
      userId: userId,
      deckId: deckId,
      correctCount: parseInt(correct),
      wrongCount: parseInt(wrong),
      totalCards: parseInt(total),
      mode: mode, 
      timeSpent: parseInt(timeSpent) || 0,
      score: parseInt(score) || 0,
      sessionDate: new Date()
    });
    
    console.log(`[SUCCESS] Сессия сохранена! ID: ${session.id}`);
    
    res.json({
      success: true,
      message: 'Сессия успешно сохранена',
      sessionId: session.id
    });
    
  } catch (error) {
    console.error('[ERROR] Ошибка сохранения:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сохранения сессии',
      error: error.message
    });
  }
});

// API для импорта публичной колоды
app.post('/api/decks/:id/import', requireAuth, async (req, res) => {
  try {
    const originalDeckId = parseInt(req.params.id);
    const userId = req.session.user.id;
    
    // Находим оригинальную колоду
    const originalDeck = await Deck.findByPk(originalDeckId, {
      include: [Card]
    });
    
    if (!originalDeck) {
      return res.status(404).json({ 
        success: false, 
        message: 'Колода не найдена' 
      });
    }
    
    if (!originalDeck.isPublic) {
      return res.status(403).json({ 
        success: false, 
        message: 'Невозможно импортировать приватную колоду' 
      });
    }
    
    if (originalDeck.userId === userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Вы не можете импортировать свою собственную колоду' 
      });
    }
    
    const importedDeck = await Deck.create({
      name: originalDeck.name + ' (импорт)',
      description: originalDeck.description,
      isPublic: false, 
      isPublished: false,
      status: 'draft',
      userId: userId
    });
    
    if (originalDeck.Cards && originalDeck.Cards.length > 0) {
      const cardsToCreate = originalDeck.Cards.map(card => ({
        question: card.question,
        answer: card.answer,
        deckId: importedDeck.id,
        tags: card.tags,
        userId: userId
      }));
      
      await Card.bulkCreate(cardsToCreate);
    }
    
    console.log(`Колода "${originalDeck.name}" импортирована пользователем ${userId} как ID ${importedDeck.id}`);
    
    res.json({ 
      success: true, 
      message: 'Колода успешно импортирована',
      deckId: importedDeck.id
    });
    
  } catch (error) {
    console.error('Ошибка при импорте колоды:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера при импорте колоды' 
    });
  }
});


// Административная панель 
app.get('/admin', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.redirect('/dashboard');
    }
    
    const pendingDecks = await Deck.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: User,
          attributes: ['username', 'email']
        },
        {
          model: Card,
          attributes: ['id']
        }
      ]
    });
    
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'createdAt'],
      include: [{
        model: Deck,
        attributes: ['id'],
        required: false
      }]
    });
    
    const usersWithDeckCount = users.map(user => {
      const userData = user.toJSON();
      userData.DeckCount = user.Decks ? user.Decks.length : 0;
      return userData;
    });
    
    // Получаем статистику
    const usersCount = await User.count();
    const decksCount = await Deck.count();
    const cardsCount = await Card.count();
    const publicDecksCount = await Deck.count({
      where: { 
        isPublic: true, 
        isPublished: true,
        status: 'approved' 
      }
    });
    
    res.render('admin/dashboard', {
      title: 'Административная панель',
      pendingDecks,
      users: usersWithDeckCount,
      currentUserId: req.session.user.id,
      usersCount,
      decksCount,
      cardsCount,
      publicDecksCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// Модерация колод - ОДОБРЕНИЕ
app.post('/admin/decks/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deck = await Deck.findByPk(req.params.id);
    
    if (!deck) {
      return res.status(404).json({ 
        success: false, 
        error: 'Колода не найдена' 
      });
    }
    
    deck.status = 'approved';
    deck.isPublished = true;
    await deck.save();
    
    console.log(`Колода ID ${deck.id} "${deck.name}" одобрена администратором ${req.session.user.id}`);
    
    res.json({ 
      success: true,
      message: 'Колода успешно одобрена',
      deckId: deck.id,
      newStatus: 'approved'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера при одобрении колоды' 
    });
  }
});

// Модерация колод - ОТКЛОНЕНИЕ
app.post('/admin/decks/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deck = await Deck.findByPk(req.params.id);
    
    if (!deck) {
      return res.status(404).json({ 
        success: false, 
        error: 'Колода не найдена' 
      });
    }
    
    const { reason } = req.body;
    
    deck.status = 'rejected';
    deck.isPublished = false;
    await deck.save();
    
    console.log(`Колода ID ${deck.id} "${deck.name}" отклонена администратором ${req.session.user.id}. Причина: ${reason || 'не указана'}`);
    
    res.json({ 
      success: true,
      message: 'Колода отклонена',
      deckId: deck.id,
      newStatus: 'rejected',
      reason: reason
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера при отклонении колоды' 
    });
  }
});

// Управление пользователями - ИЗМЕНЕНИЕ РОЛИ 
app.post('/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id);
        const currentUserId = req.session.user.id;
        const { role } = req.body;
        
        console.log(`Изменение роли: ${targetUserId} -> ${role} (запрашивает: ${currentUserId})`);
        
        if (targetUserId === 1) {
            console.log('Попытка изменить роль главного администратора!');
            return res.status(403).json({ 
                success: false, 
                error: 'Роль главного администратора не может быть изменена' 
            });
        }
        
        if (targetUserId === currentUserId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Нельзя изменить свою собственную роль' 
            });
        }
        
        const user = await User.findByPk(targetUserId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        if (user.role === 'admin' && currentUserId !== 1) {
            return res.status(403).json({ 
                success: false, 
                error: 'Только главный администратор может изменять роли администраторов' 
            });
        }
        
        if (role === 'admin' && currentUserId !== 1) {
            return res.status(403).json({ 
                success: false, 
                error: 'Только главный администратор может назначать администраторов' 
            });
        }
        
        await user.update({ role });
        
        console.log(`✓ Роль пользователя ${targetUserId} изменена на "${role}"`);
        
        res.json({ 
            success: true,
            message: 'Роль пользователя успешно изменена'
        });
        
    } catch (error) {
        console.error('Ошибка при изменении роли:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});


// Простой тестовый маршрут для отладки удаления
app.delete('/test/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('Тестовое удаление пользователя ID:', req.params.id);
        console.log('Текущий пользователь ID:', req.session.user.id);
        
        res.json({ 
            success: true,
            message: 'Тестовое удаление успешно',
            userId: req.params.id,
            test: 'Это тестовый ответ'
        });
    } catch (error) {
        console.error('Ошибка в тестовом удалении:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});


// Управление пользователями - УДАЛЕНИЕ 
app.delete('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id);
        const currentUserId = req.session.user.id;
        
        console.log(`Попытка удаления пользователя ${targetUserId} администратором ${currentUserId}`);
        
        if (targetUserId === currentUserId) {
            console.log('Ошибка: Попытка удалить самого себя');
            return res.status(403).json({ 
                success: false, 
                error: 'Нельзя удалить самого себя' 
            });
        }
        
        if (targetUserId === 1) {
            console.log('Ошибка: Попытка удалить главного администратора');
            return res.status(403).json({ 
                success: false, 
                error: 'Главный администратор не может быть удален' 
            });
        }
        
        const user = await User.findByPk(targetUserId);
        
        if (!user) {
            console.log('Ошибка: Пользователь не найден');
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        if (user.role === 'admin' && currentUserId !== 1) {
            console.log('Ошибка: Обычный администратор пытается удалить администратора');
            return res.status(403).json({ 
                success: false, 
                error: 'Только главный администратор может удалять администраторов' 
            });
        }
        

        const username = user.username;
        
        const userDecks = await Deck.findAll({ where: { userId: targetUserId } });
        const deckIds = userDecks.map(deck => deck.id);
        
        if (deckIds.length > 0) {
            await Card.destroy({ 
                where: { 
                    deckId: { 
                        [Op.in]: deckIds 
                    } 
                } 
            });
        }
        
        await Deck.destroy({ where: { userId: targetUserId } });
        await user.destroy();
        
        console.log(`✓ Пользователь ID ${targetUserId} "${username}" удален администратором ${currentUserId}`);
        
        res.json({ 
            success: true,
            message: 'Пользователь успешно удален',
            userId: targetUserId,
            username: username
        });
    } catch (error) {
        console.error('❌ Ошибка при удалении пользователя:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера при удалении пользователя' 
        });
    }
});

// API для получения активности 
app.get('/api/admin/activity', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Доступ запрещен' 
      });
    }
    
    const recentUsers = await User.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'username', 'role', 'createdAt']
    });
    
    const recentDecks = await Deck.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [{
        model: User,
        attributes: ['username']
      }],
      attributes: ['id', 'name', 'status', 'createdAt']
    });
    
    const activities = [];
    
    // Добавляем активность по новым пользователям
    recentUsers.forEach(user => {
      activities.push({
        icon: 'user-plus',
        message: `Новый пользователь: ${user.username} (${user.role})`,
        timestamp: user.createdAt
      });
    });
    
    // Добавляем активность по новым колодам
    recentDecks.forEach(deck => {
      const statusText = deck.status === 'approved' ? 'одобрена' : 
                        deck.status === 'pending' ? 'ожидает модерации' : 
                        deck.status === 'rejected' ? 'отклонена' : 'создана';
      
      activities.push({
        icon: 'book',
        message: `Колода "${deck.name}" ${statusText} (автор: ${deck.User.username})`,
        timestamp: deck.createdAt
      });
    });
    
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const recentActivities = activities.slice(0, 10);
    
    res.json({
      success: true,
      activities: recentActivities
    });
  } catch (error) {
    console.error('Ошибка при получении активности:', error);
    res.json({
      success: true,
      activities: [
        {
          icon: 'info-circle',
          message: 'Система загружена и работает',
          timestamp: new Date()
        }
      ]
    });
  }
});

const statsCache = {
  platform: null,
  lastUpdate: null,
  cacheDuration: 10 * 1000 
};



// API для библиотеки - все колоды
app.get('/api/library/decks', async (req, res) => {
    try {
        console.log('[API] Запрос всех колод библиотеки');
        
        const publicDecks = await Deck.findAll({
            where: { 
                isPublic: true, 
                isPublished: true,
                status: 'approved' 
            },
            include: [{
                model: User,
                attributes: ['username']
            }],
            order: [['createdAt', 'DESC']]
        });
        
        const decksData = publicDecks.map(deck => ({
            id: deck.id,
            name: deck.name,
            description: deck.description || '',
            createdAt: deck.createdAt,
            username: deck.User.username
        }));
        
        console.log(`[API] Отправлено ${decksData.length} колод`);
        
        res.json({
            success: true,
            decks: decksData
        });
    } catch (error) {
        console.error('[API] Ошибка при получении колод библиотеки:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// API для библиотеки 
app.get('/api/library/decks-with-sessions', async (req, res) => {
    try {
        console.log('[API] Запрос колод с сессиями');
        
        const publicDecks = await Deck.findAll({
            where: { 
                isPublic: true, 
                isPublished: true,
                status: 'approved' 
            },
            include: [
                {
                    model: User,
                    attributes: ['username']
                }
            ]
        });
        
        // Для каждой колоды считаем сессии отдельно
        const decksWithSessions = [];
        
        for (const deck of publicDecks) {
            const sessionCount = await StudySession.count({
                where: { deckId: deck.id }
            });
            
            decksWithSessions.push({
                id: deck.id,
                name: deck.name,
                description: deck.description || '',
                createdAt: deck.createdAt,
                username: deck.User.username,
                sessionsCount: sessionCount
            });
        }
        
        console.log(`[API] Отправлено ${decksWithSessions.length} колод с сессиями`);
        
        res.json({
            success: true,
            decks: decksWithSessions
        });
    } catch (error) {
        console.error('[API] Ошибка при получении колод с сессиями:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});

// Тестовый эндпоинт для отладки
app.get('/api/debug/library-data', async (req, res) => {
    try {
        console.log('[DEBUG] Запрос тестовых данных библиотеки');
        
        const publicDecks = await Deck.findAll({
            where: { 
                isPublic: true, 
                isPublished: true,
                status: 'approved' 
            },
            include: [{
                model: User,
                attributes: ['username']
            }],
            limit: 10
        });
        
        const decksWithSessionCounts = [];
        
        for (const deck of publicDecks) {
            const sessionCount = await StudySession.count({
                where: { deckId: deck.id }
            });
            
            decksWithSessionCounts.push({
                id: deck.id,
                name: deck.name,
                description: deck.description || '',
                createdAt: deck.createdAt,
                username: deck.User.username,
                sessionsCount: sessionCount
            });
        }
        
        res.json({
            success: true,
            decks: decksWithSessionCounts,
            message: `Загружено ${decksWithSessionCounts.length} колод`
        });
    } catch (error) {
        console.error('[DEBUG] Ошибка в тестовом маршруте:', error);
        res.json({
            success: false,
            decks: [],
            message: error.message
        });
    }
});



app.get('/api/stats', async (req, res) => {
    try {
        // Проверяем кэш
        const now = Date.now();
        if (statsCache.platform && statsCache.lastUpdate && 
            (now - statsCache.lastUpdate) < statsCache.cacheDuration) {
            console.log('[STATS] Отдаем из кэша');
            return res.json(statsCache.platform);
        }
        
        const usersCount = await User.count();
        const decksCount = await Deck.count();
        const cardsCount = await Card.count();
        const publicDecksCount = await Deck.count({
            where: { 
                isPublic: true, 
                isPublished: true,
                status: 'approved' 
            }
        });
        const sessionsCount = await StudySession.count();
        
        const stats = {
            success: true,
            usersCount,
            decksCount,
            cardsCount,
            publicDecksCount,
            sessionsCount,
            lastUpdated: new Date().toISOString()
        };
        
        // Сохраняем в кэш
        statsCache.platform = stats;
        statsCache.lastUpdate = now;
        
        res.json(stats);
    } catch (error) {
        console.error('Ошибка при получении статистики:', error);
        
        // Пытаемся вернуть данные из кэша, если есть
        if (statsCache.platform) {
            console.log('[STATS] Ошибка, но есть кэш');
            return res.json({
                ...statsCache.platform,
                cached: true,
                success: false,
                error: 'Ошибка обновления, показаны кэшированные данные'
            });
        }
        
        // Если кэша нет, возвращаем базовые значения
        res.json({
            success: false,
            message: 'Ошибка сервера',
            usersCount: 3,
            decksCount: 2,
            cardsCount: 7,
            publicDecksCount: 1,
            sessionsCount: 0,
            lastUpdated: new Date().toISOString()
        });
    }
});
// API для поиска колод
app.get('/api/decks/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim() === '') {
            return res.json({
                success: true,
                results: []
            });
        }
        
        const decks = await Deck.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${q}%` } },
                    { description: { [Op.like]: `%${q}%` } }
                ],
                isPublic: true,
                isPublished: true,
                status: 'approved'
            },
            include: [{
                model: User,
                attributes: ['username']
            }],
            limit: 10
        });
        
        res.json({
            success: true,
            results: decks
        });
    } catch (error) {
        console.error('Ошибка при поиске колод:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера'
        });
    }
});


// маршрут статистики
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user?.id;
    
    console.log(`[STATS] Запрос статистики для пользователя ${userId}`);
    
    if (!userId) {
      console.error('[STATS] userId не найден');
      return res.json({
        success: true,
        studiedToday: 0,
        sessionsToday: 0,
        totalSessions: 0,
        userDecksCount: 0,
        totalCardsCount: 0,
        message: 'Пользователь не аутентифицирован'
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Количество колод пользователя
    const userDecksCount = await Deck.count({ 
      where: { userId } 
    });
    
    // Количество карточек пользователя
    const userDecks = await Deck.findAll({ 
      where: { userId },
      attributes: ['id']
    });
    
    let totalCardsCount = 0;
    if (userDecks.length > 0) {
      const deckIds = userDecks.map(deck => deck.id);
      totalCardsCount = await Card.count({
        where: { deckId: deckIds }
      });
    }
    
    // Сессии пользователя
    const totalSessions = await StudySession.count({ 
      where: { userId } 
    });
    
    // Сессии сегодня
    const sessionsToday = await StudySession.count({
      where: {
        userId,
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    });
    
    // Изученные сегодня карточки
    let studiedToday = 0;
    if (sessionsToday > 0) {
      const todaySessions = await StudySession.findAll({
        where: {
          userId,
          createdAt: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        },
        attributes: ['correctAnswers']  
      });
      
      studiedToday = todaySessions.reduce((sum, session) => {
        return sum + (parseInt(session.correctAnswers) || 0);
      }, 0);
    }
    
    console.log(`[STATS] Результаты: studiedToday=${studiedToday}, sessionsToday=${sessionsToday}`);
    
    res.json({
      success: true,
      studiedToday,
      sessionsToday,
      totalSessions,
      userDecksCount,
      totalCardsCount,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[STATS] Ошибка:', error);
    res.json({
      success: true,
      studiedToday: 0,
      sessionsToday: 0,
      totalSessions: 0,
      userDecksCount: 0,
      totalCardsCount: 0,
      error: error.message
    });
  }
});




// Запуск сервера
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к базе данных установлено');
     await checkStudySessionTable();
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
      console.log(`👤 Тестовые пользователи:`);
      console.log(`   Администратор: admin@kdz.ru / admin123`);
      console.log(`   Преподаватель: teacher@kdz.ru / teacher123`);
      console.log(`   Студент: student@kdz.ru / student123`);
      console.log(`\n📊 Пути администратора:`);
      console.log(`   Админ-панель: http://localhost:${PORT}/admin`);
      console.log(`   Панель модерации: http://localhost:${PORT}/admin#moderation`);
      console.log(`   Управление пользователями: http://localhost:${PORT}/admin#users`);
    });
  } catch (error) {
    console.error('❌ Не удалось запустить сервер:', error);
  }
};

startServer();