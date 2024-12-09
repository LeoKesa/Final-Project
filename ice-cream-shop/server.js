//***  Christina DiMaggio, Leonidas Kesaris, and James Black
//*** Data Base Management Systems 
//*** 12/9/2024
//*** Final Project: In the project a Node JS server takes request from the html files, and modifys SQL DBwith queries within.


//////////////////////////////////// SERVER ///////////////////////////////////////////////////////////////////////
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./db');
const app = express();
const PORT = 3000;

//  Serving the home page 
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTMLStuff', 'index.html'));
});

//Serving signup page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTMLStuff', 'signup.html'));
});

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// SESSION TRACKING EXTRA CREDIT 
app.use(session({
  secret: 'secret session', resave: false, // wont keep saving 
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'HTMLStuff'))); // serves css 

// login route gets email and password from database, also checks for validity before storing inputs.
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // checks if email is in the customers table
  const query = 'SELECT * FROM customers WHERE Email = ?';
  db.query(query, [email], (err, results) => {
    if (err) { 
      return res.status(500).json({ error: err.message });
    }

    // no email then error returned
    if (results.length === 0) { 
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];

    // checks password given vs one stored 
    if (password.trim() !== user.password.trim()) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // store user ID and username in the session for more requests
    req.session.userId = user.CustomerID;
    req.session.user = { username: user.FullName };  
    return res.redirect('/menu.html'); // sends to the menu when you login.
  });
});

// signup route validates to make sure all the fields have been filled in then stores in session.
app.post('/signup', (req, res) => {
  const { email, password, name, phone, address, city, state, zipCode } = req.body;

  // checks that all fields are given by user 
  if (!email || !password || !name || !phone || !address || !city || !state || !zipCode) {
    return res.status(400).json({ message: 'Please provide all required fields!!!!!' });
  }

  // inserts new user into the customers table
  const query = 'INSERT INTO customers (Email, password, FullName, Phone, Address, City, State, ZipCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [email, password, name, phone, address, city, state, zipCode], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'There was an error creating user' });
    }

    // Store user ID and username in session
    req.session.userId = results.insertId;
    req.session.user = { username: name };  
    return res.redirect('/menu.html');
  });
});

// Menu functionality for ordering ice cream, deducts stock, and makes order and shipping records.
app.post('/buy', (req, res) => {
  const { icecreams, shipping } = req.body;
  const customerId = req.session.userId;  // Use session data for customerId

  // Ensure the user is logged in
  if (!customerId) {
    return res.status(400).json({ message: 'Please login to your Ice Dream Account to make a purchase!' });
  }

  // Log the incoming data
  console.log('Received data:', req.body);


  // make sure icecreams and shipping data or valid
  if (!Array.isArray(icecreams) || icecreams.length === 0 || !shipping) { 
    console.error('Invalid input data: icecreams missing');
    return res.status(400).json({ message: 'Invalid input data: icecreams missing' });
  }

  let totalAmount = 0;
  const orderItems = []; // initialize array for orderItems 

 // process icecream in order, makes sure it has IceCreamID 
  icecreams.forEach((item) => {
    const { IceCreamID, quantity } = item;
    if (!IceCreamID || !quantity) { 
      console.error('Invalid ice cream data!');
      return res.status(400).json({ message: 'Invalid ice cream data' });}

//query to get price stock name of icecream
    const query = 'SELECT Price, Stock, Name FROM icecreams WHERE IceCreamID = ?';
    db.query(query, [IceCreamID], (err, results) => {
      if (err) {
        console.error('Database error during stock check:', err);
        return res.status(500).json({ error: err.message });}

      if (results.length === 0) {
        console.error(`Ice cream with ID ${IceCreamID} not found`);
        return res.status(404).json({ message: `Ice cream with ID ${IceCreamID} not found` });}

        // if icecream found get stock level and price
      const IceCream = results[0];
      const stock = IceCream.Stock;

      //handles if the stock depleted to 0 
      if (quantity > stock) {
        console.error(`Not enough stock for ${IceCream.Name}. Requested: ${quantity}, Available: ${stock}`);
        return res.status(400).json({ message: `Not enough stock for ${IceCream.Name}` });
      }

      //calculates subtotal (not used can only buy one at a time)
      const subTotal = IceCream.Price * quantity;
      totalAmount += subTotal;

      // puts data onto the orderIrems array
      orderItems.push({ IceCreamID, quantity, subTotal });

      //updates stock level in database
      const updateStockQuery = 'UPDATE icecreams SET Stock = ? WHERE IceCreamID = ?';
      db.query(updateStockQuery, [stock - quantity, IceCreamID], (err) => {
        if (err) {
          console.error('Database error during stock update:', err);
          return res.status(500).json({ error: err.message });
        }
      });
    });
  });

  // insertsorder into the orders table.
  const insertOrderQuery = 'INSERT INTO orders (CustomerID, TotalAmount, Status) VALUES (?, ?, ?)';
  db.query(insertOrderQuery, [customerId, totalAmount, 'Pending'], (err, results) => {
    if (err) {
      console.error('Error inserting order:', err);
      return res.status(500).json({ error: err.message });
    }

    const orderId = results.insertId; // id of new order 

    //inserts details of each order
    orderItems.forEach((item) => {
      const { IceCreamID, quantity, subTotal } = item;


      const insertOrderDetailsQuery = 'INSERT INTO orderdetails (OrderID, IceCreamID, Quantity, SubTotal) VALUES (?, ?, ?, ?)';
      db.query(insertOrderDetailsQuery, [orderId, IceCreamID, quantity, subTotal], (err) => {
        if (err) {
          console.error('Error inserting order details:', err);
          return res.status(500).json({ error: err.message });
        }
      });
    });

    //insert the shipping info into table per order.
    const { shippingMethod, shippingCost, shippingAddress, city, state, zipCode } = shipping;
    const insertShippingQuery = 'INSERT INTO shipping (OrderID, ShippingMethod, ShippingCost, ShippingAddress, City, State, ZipCode) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(insertShippingQuery, [orderId, shippingMethod, shippingCost, shippingAddress, city, state, zipCode], (err) => {
      if (err) {
        console.error('Error inserting shipping details:', err);
        return res.status(500).json({ error: err.message });
      }

      //Everything works you guys will see this. 
      res.status(200).json({ message: 'You bought the ice cream successfully!' });
    });
  });
});

//route to update stock on admin page. 
app.post('/update_stock', (req, res) => {
  const { IceCreamID, stock } = req.body;

  // query updates stock of given IceCreamID
  const query = 'UPDATE icecreams SET Stock = ? WHERE IceCreamID = ?';
  db.query(query, [stock, IceCreamID], (err, results) => {
      if (err) {
          console.error('Error updating stock:', err);
          return res.status(500).send('Error updating stock');
      }

      res.redirect('/menu.html'); // Reload the admin panel
  });
});

// POST route to delete a user
app.post('/delete_user', (req, res) => {
  const { CustomerID } = req.body;

  // Query to delete the user from the database by their CustomerID
  const query = 'DELETE FROM customers WHERE CustomerID = ?';
  db.query(query, [CustomerID], (err, results) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).send('Error deleting user');
    }
    // Redirect back to the admin panel after deleting the user
    res.redirect('/login.html');
  });
});


// Route to get the ice creams
app.get('/api/icecreams', (req, res) => {
  db.query('SELECT * FROM icecreams', (err, results) => {
    if (err) {
      console.error('Error fetching ice creams:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// endpoint to check if the user is logged in
app.get('/api/user', (req, res) => {
  if (req.session.user) {
    res.json({ username: req.session.user.username });
  } else {
    res.json({ username: null });
  }
});

// endpoint for logout function
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to log out' });
    }

    // Redirect to the login page after session is destroyed
    res.redirect('/login.html');
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
