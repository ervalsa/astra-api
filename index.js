require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');

const serviceAccount = {
    type: process.env.TYPE,
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const app = express();
const db = admin.firestore();
const port  = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send("Astra API is running...")
})

// Get Specific dealers by LocationId
async function getDealersByLocationId(locationId) {
    try {
        const dealersRef = db.collection('dealers');
        const querySnapshot = await dealersRef.where('locationId', '==', locationId).get();

        const dealers = [];
        querySnapshot.forEach((doc) => {
            const dealerData = doc.data();
            dealers.push({
                ...dealerData
            });
        });

        return dealers;
    } catch(error) {
        console.error('Error fetching dealers: ', error);
        throw new Error('Something went wrong');
    }
}

// Get all dealers
app.get('/api/v1/dealer', (req, res) => {
    db.collection('dealers').get()
        .then(snapshot => {
            const data = snapshot.docs.map(doc => doc.data());
            res.json({
                message: 'Dealers fetched successfuly',
                listDealer: data
            });
        })
        .catch(error => {
            res.status(500).json({ error: 'Something went wrong.' });
        })
});

// Get specific dealers by LocationId
app.get('/api/v1/dealer/:locationId', async (req, res) => {
    const locationId = req.params.locationId;

    try {
        const dealers = await getDealersByLocationId(locationId);
        res.json({
            message: 'Dealers fetched successfully',
            listDealer: dealers
        })
    } catch(error) {
        res.status(500).json({ error: 'Something went wrong.' })
    }
});

// Login
app.post('/api/v1/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const userRef = db.collection('users').where('username', '==', username).limit(1);
        const userSnapshot = await userRef.get();

        if (userSnapshot.empty) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        if (userData.password !== password) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }

        const loginResult = {
            name: userData.name,
            username: userData.username
        }

        res.json({ 
            message: 'success',
            loginResult: loginResult
        })
    } catch(error) {
        console.log('Error during login: ', error);
        res.status(500).json({ error: "Something went wrong" });
    }
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
});