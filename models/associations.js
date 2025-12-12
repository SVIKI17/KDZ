// models/associations.js 
const User = require('./User');
const Deck = require('./Deck');
const Card = require('./Card');
const StudySession = require('./StudySession');
const UserCardProgress = require('./UserCardProgress');


User.hasMany(Deck, { foreignKey: 'userId' });
Deck.belongsTo(User, { foreignKey: 'userId' });


Deck.hasMany(Card, { foreignKey: 'deckId' });
Card.belongsTo(Deck, { foreignKey: 'deckId' });

// Сессии обучения /пользоватьль
User.hasMany(StudySession, { 
  foreignKey: 'userId',
  as: 'studySessions'
});
StudySession.belongsTo(User, { 
  foreignKey: 'userId',
  as: 'user'
});

// сессии обучения /карточки
Deck.hasMany(StudySession, { 
  foreignKey: 'deckId',
  as: 'studySessions'
});
StudySession.belongsTo(Deck, { 
  foreignKey: 'deckId',
  as: 'deck'
});

// Прогресс по карточкам
User.hasMany(UserCardProgress, { foreignKey: 'userId' });
UserCardProgress.belongsTo(User, { foreignKey: 'userId' });

Card.hasMany(UserCardProgress, { foreignKey: 'cardId' });
UserCardProgress.belongsTo(Card, { foreignKey: 'cardId' });

Deck.hasMany(UserCardProgress, { foreignKey: 'deckId' });
UserCardProgress.belongsTo(Deck, { foreignKey: 'deckId' });

module.exports = {
  User,
  Deck,
  Card,
  StudySession,
  UserCardProgress
};