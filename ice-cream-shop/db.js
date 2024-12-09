//***  Christina DiMaggio, Leonidas Kesaris, and James Black
//*** Data Base Management Systems 
//*** 12/9/2024
//*** Final Project: In the project a Node JS server takes request from the html files, and modifys SQL DBwith queries within.


//////////////////////////////////// DB ////////////////////////////////////////////////////////////////////
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "34.72.209.251",  // Public IP address of your Cloud SQL instance
  user: "root",            
  password: "1234",        
  database: "ice_cream_shop", 
});

db.connect((err) => {
  if (err) {
    console.error("MySQL connection failed:", err.message);
    process.exit(1);  // Exit the application if connection fails
  } else {
    console.log("Connected to MySQL successfully!");//woooo
  }
});

// Export the db connection 
module.exports = db;
