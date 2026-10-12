async function migrateProducts(sequelize) {
  await sequelize.query(`
    IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Products (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
        Name NVARCHAR(120) NOT NULL,
        Description NVARCHAR(1000) NULL,
        Price DECIMAL(10,2) NOT NULL,
        Stock INT NOT NULL CONSTRAINT DF_Products_Stock DEFAULT (0),
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_Products_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT CK_Products_Price_Nonnegative CHECK (Price >= 0),
        CONSTRAINT CK_Products_Stock_Nonnegative CHECK (Stock >= 0)
      );
    END;
  `);
}

module.exports = { migrateProducts };