const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
dotenv.config();

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

// config multer with storage
const upload = multer();

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.STORAGE_BUCKET
});

const app = express();
const db = admin.firestore();
const port  = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

class TaskModel {
    constructor(id, dealerId, name, description, status, picName, taskTemuanPhotos, taskProgressPhotos, taskStartDate, taskEndDate) {
      this.id = id;
      this.dealerId = dealerId;
      this.name = name;
      this.description = description;
      this.status = status;
      this.picName = picName;
      this.taskTemuanPhotos = taskTemuanPhotos;
      this.taskProgressPhotos = taskProgressPhotos;
      this.taskStartDate = taskStartDate;
      this.taskEndDate = taskEndDate;
    }
  }

// Default Route
app.get('/', (req, res) => {
    res.send("Astra API is running...")
})

// User Route
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

// Location Route
// Get All Location
app.get('/api/v1/location', async (req, res) => {
    try {
        const locationQuerySnapshot = await db.collection('location').get();
        const locations = [];
        locationQuerySnapshot.forEach((doc) => {
            const locationData = doc.data();
            locations.push({
                id: doc.id,
                ...locationData
            })
        });

        res.json({
            message: 'Locations fetched successfully',
            listLocation: locations
        })
    } catch(error) {
        res.status(500).json({ error: 'Something went wrong.' });
    }
});

// Get Location by ID
app.get('/api/v1/location/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const locationQuerySnapshot = await db.collection('location').doc(id).get();
        
        if (!locationQuerySnapshot.exists) {
            throw new Error('Location not found.')
        }

        const locationData = locationQuerySnapshot.data();

        res.json({
            message: 'Location fetched successfully',
            locationData: {
                id: locationQuerySnapshot.id,
                ...locationData
            }
        });
    } catch(error) {
        res.status(500).json({ error: 'Something went wrong.' });
    }
});

// Dealer Route
// Get All Dealers
app.get('/api/v1/dealer', async (req, res) => {
    try {
        const dealerQuerySnapshot = await db.collection('dealers').get();
        const dealers = [];
        dealerQuerySnapshot.forEach((doc) => {
            const dealerData = doc.data();
            dealers.push({
                id: doc.id,
                ...dealerData
            });
        });

        res.json({
            message: 'Dealers fetched successfully',
            listDealers: dealers
        })
    } catch(error) {
        res.status(500).json({ error: 'Something went wrong.' })
    }
});

// Get Specific Dealers by LocationName
async function getDealersByLocationName(locationName) {
    try {
        const locationQuerySnapshot = await db.collection('location').where('name', '==', locationName).get();

        if (!locationQuerySnapshot) {
            throw new Error('Location not found.')
        }

        const locationDoc = locationQuerySnapshot.docs[0];
        const locationId = locationDoc.id;

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

// Task Route
// uploadPhotoToFirestore
async function uploadPhotoToFirestore(file, folderPath, taskId) {
    try {
        const bucket = admin.storage().bucket();
        const fileName = folderPath + '/'+ taskId + '/' + Date.now() + '_' + file.originalname;
        const fileUpload = bucket.file(fileName);
        
        await new Promise((resolve, reject) => {
            const blobStream = fileUpload.createWriteStream({ resumable: false });
            blobStream.on('error', reject);
            blobStream.on('finish', resolve);
            blobStream.end(file.buffer);
        });
  
        await fileUpload.makePublic();

        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
        return imageUrl;
    } catch (error) {
        console.error('Error uploading photo to Firestore: ', error);
        throw new Error('Failed to upload photo to Firestore');
    }
}

// saveTaskToFirestore
async function saveTaskToFirestore(task, taskTemuanPhotos, taskProgressPhotos) {
    try {
        const tasksCollection = db.collection('tasks');

        if (!task.name) {
            throw new Error('Task name is required');
        }

        const taskData = {
            dealerId: task.dealerId || '',
            name: task.name || '',
            description: task.description || '',
            status: task.status || '',
            picName: task.picName || '',
            taskTemuanPhotos: [],
            taskProgressPhotos: [],
            taskStartDate: task.taskStartDate || null,
            taskEndDate: task.taskEndDate || null,
        };

        const docRef = await tasksCollection.add(taskData);
        const taskId = docRef.id;

        taskData.taskTemuanPhotos = await Promise.all(taskTemuanPhotos.map(file => uploadPhotoToFirestore(file, 'temuan', taskId)));
        taskData.taskProgressPhotos = await Promise.all(taskProgressPhotos.map(file => uploadPhotoToFirestore(file, 'progress', taskId)));

        await docRef.update(taskData)

        return taskId;
    } catch (error) {
        console.error('Error saving task to Firestore: ', error);
        throw new Error('Failed to save task to Firestore');
    }
}

// Add Task
app.post('/api/v1/task', upload.fields([{ name: 'taskTemuanPhotos' }, { name: 'taskProgressPhotos' }]), async (req, res) => {
    try {
        const dealerId = req.body.dealerId;
        const name = req.body.name;
        const description = req.body.description;
        const status = req.body.status;
        const picName = req.body.picName;
        const taskStartDate = req.body.taskStartDate;
        const taskEndDate = req.body.taskEndDate;
  
        let taskTemuanPhotos = req.files['taskTemuanPhotos'] || [];
        let taskProgressPhotos = req.files['taskProgressPhotos'] || [];
    
        const task = new TaskModel(
            null,
            dealerId,
            name,
            description,
            status,
            picName,
            taskTemuanPhotos,
            taskProgressPhotos,
            taskStartDate,
            taskEndDate
        );
    
        const taskId = await saveTaskToFirestore(task, taskTemuanPhotos, taskProgressPhotos);
    
        res.json({ 
            message: 'Task added successfully', 
            data: task
        });
    } catch (error) {
        console.error('Error adding task: ', error);
        res.status(500).json({ error: 'Failed to add task' });
    }
});

// Server Status
app.listen(port, () => {
    console.log(`Server is listening on url http://localhost:${port}`)
});