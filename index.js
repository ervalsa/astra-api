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

// Get specific dealers by LocationName
async function getDealersByLocationName(locationName) {
    try {
        const locationQuerySnapshot = await db.collection('location').where('name', '==', locationName).get();

        if (!locationQuerySnapshot) {
            throw new Error('Location not found')
        }

        const locationDoc = locationQuerySnapshot.docs[0];
        const locationId = locationDoc.id;
        console.log("locationid: ", locationId)

        const dealersQuerySnapshot = await db.collection('dealers').where('locationId', '==', locationId).get();

        const dealers = [];
        dealersQuerySnapshot.forEach((doc) => {
            const dealerData = doc.data();
            dealers.push({
                id: doc.id,
                ...dealerData
            });
        });

        return dealers
    } catch(error) {
        console.error('Error fetching dealers by location name: ', error);
        throw new Error('Something went wrong');
    }
}

app.get('/api/v1/dealer/:locationName', async (req, res) => {
    const locationName = req.params.locationName;
    console.log(locationName)

    try {
        const dealers = await getDealersByLocationName(locationName);
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
            res.status(401).json({ error: 'User not found' });
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