const { DataTypes } = require('sequelize');

function defineProduct(sequelize) {
  return sequelize.define('Product', {
    Id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    Name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    Description: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    Price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    Stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'Products',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt'
  });
}

module.exports = { defineProduct };