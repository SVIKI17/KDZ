// models/UserCardProgress.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserCardProgress = sequelize.define('UserCardProgress', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  cardId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  deckId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('not_learned', 'learning', 'review', 'mastered'),
    defaultValue: 'not_learned'
  },
  lastReviewed: {
    type: DataTypes.DATE
  },
  nextReview: {
    type: DataTypes.DATE
  },
  correctStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  correctReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

module.exports = UserCardProgress;