// models/StudySession.js 
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StudySession = sequelize.define('StudySession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  deckId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Decks',
      key: 'id'
    }
  },
  mode: {
    type: DataTypes.ENUM('swipe', 'speed_challenge'),
    allowNull: false,
    defaultValue: 'swipe'
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  totalCards: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  correctAnswers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    },
    // Для совместимости с фронтендом, который может использовать correctCount
    get() {
      return this.getDataValue('correctAnswers');
    },
    set(value) {
      this.setDataValue('correctAnswers', value);
    }
  },
  wrongAnswers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  timeSpent: {
    type: DataTypes.INTEGER, // в секундах
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  accuracy: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  sessionDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  completedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'StudySessions',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  hooks: {
    beforeCreate: (session) => {
      // Автоматически рассчитываем точность
      if (session.totalCards > 0) {
        session.accuracy = Math.round((session.correctAnswers / session.totalCards) * 100);
      }
      
      // Рассчитываем score если не указан
      if (!session.score && session.totalCards > 0) {
        session.score = Math.round((session.correctAnswers / session.totalCards) * 100);
      }
    },
    beforeUpdate: (session) => {
      // Обновляем accuracy при изменении ответов
      if (session.changed('correctAnswers') || session.changed('totalCards')) {
        if (session.totalCards > 0) {
          session.accuracy = Math.round((session.correctAnswers / session.totalCards) * 100);
        }
      }
      
      // Обновляем score если не указан
      if (session.changed('correctAnswers') || session.changed('totalCards')) {
        if (!session.score && session.totalCards > 0) {
          session.score = Math.round((session.correctAnswers / session.totalCards) * 100);
        }
      }
    }
  },
  indexes: [
    {
      name: 'idx_user_sessions',
      fields: ['userId', 'createdAt']
    },
    {
      name: 'idx_deck_sessions',
      fields: ['deckId', 'createdAt']
    },
    {
      name: 'idx_user_date',
      fields: ['userId', 'sessionDate']
    }
  ],
  // Виртуальные поля для совместимости
  getterMethods: {
    correctCount() {
      return this.correctAnswers;
    },
    wrongCount() {
      return this.wrongAnswers;
    },
    studyMode() {
      return this.mode;
    },
    // Форматированное время
    formattedTime() {
      const hours = Math.floor(this.timeSpent / 3600);
      const minutes = Math.floor((this.timeSpent % 3600) / 60);
      const seconds = this.timeSpent % 60;
      
      if (hours > 0) {
        return `${hours}ч ${minutes}м ${seconds}с`;
      } else if (minutes > 0) {
        return `${minutes}м ${seconds}с`;
      } else {
        return `${seconds}с`;
      }
    }
  },
  setterMethods: {
    correctCount(value) {
      this.correctAnswers = value;
    },
    wrongCount(value) {
      this.wrongAnswers = value;
    },
    studyMode(value) {
      this.mode = value;
    }
  }
});

// Методы экземпляра
StudySession.prototype.getSessionInfo = function() {
  return {
    id: this.id,
    userId: this.userId,
    deckId: this.deckId,
    mode: this.mode,
    score: this.score,
    totalCards: this.totalCards,
    correctAnswers: this.correctAnswers,
    wrongAnswers: this.wrongAnswers,
    timeSpent: this.timeSpent,
    accuracy: this.accuracy,
    sessionDate: this.sessionDate,
    completedAt: this.completedAt,
    // Совместимость
    correctCount: this.correctAnswers,
    wrongCount: this.wrongAnswers,
    studyMode: this.mode
  };
};

// Статические методы
StudySession.getUserStats = async function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const stats = {
    total: await this.count({ where: { userId } }),
    today: await this.count({ 
      where: { 
        userId,
        createdAt: {
          [sequelize.Sequelize.Op.gte]: today,
          [sequelize.Sequelize.Op.lt]: tomorrow
        }
      }
    }),
    totalCardsStudied: await this.sum('totalCards', { where: { userId } }),
    totalCorrectAnswers: await this.sum('correctAnswers', { where: { userId } }),
    totalTimeSpent: await this.sum('timeSpent', { where: { userId } }),
    averageAccuracy: 0
  };
  
  // Рассчитываем среднюю точность
  const allSessions = await this.findAll({ 
    where: { userId },
    attributes: ['correctAnswers', 'totalCards']
  });
  
  if (allSessions.length > 0) {
    const totalCorrect = allSessions.reduce((sum, session) => sum + session.correctAnswers, 0);
    const totalCards = allSessions.reduce((sum, session) => sum + session.totalCards, 0);
    
    if (totalCards > 0) {
      stats.averageAccuracy = Math.round((totalCorrect / totalCards) * 100);
    }
  }
  
  return stats;
};

StudySession.getTodayStats = async function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todaySessions = await this.findAll({
    where: {
      userId,
      createdAt: {
        [sequelize.Sequelize.Op.gte]: today,
        [sequelize.Sequelize.Op.lt]: tomorrow
      }
    },
    attributes: [
      'id',
      'deckId',
      'mode',
      'score',
      'totalCards',
      'correctAnswers',
      'timeSpent',
      'createdAt'
    ],
    order: [['createdAt', 'DESC']]
  });
  
  const totalCards = todaySessions.reduce((sum, session) => sum + session.totalCards, 0);
  const totalCorrect = todaySessions.reduce((sum, session) => sum + session.correctAnswers, 0);
  const totalTime = todaySessions.reduce((sum, session) => sum + session.timeSpent, 0);
  
  return {
    sessions: todaySessions.length,
    totalCards,
    totalCorrect,
    totalTime,
    averageScore: todaySessions.length > 0 
      ? Math.round(todaySessions.reduce((sum, session) => sum + session.score, 0) / todaySessions.length)
      : 0
  };
};

module.exports = StudySession;