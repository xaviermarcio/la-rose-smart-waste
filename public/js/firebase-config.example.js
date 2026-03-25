// SUAS CHAVES REAIS DA LA ROSE
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
};

// Inicialização
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Exportações unificadas para o app.js
export { 
    db, auth, 
    signInWithEmailAndPassword, 
    signOut, onAuthStateChanged,
    collection, addDoc, serverTimestamp, writeBatch, doc,
    getDocs, query, orderBy, updateDoc // EXPORTANDO O updateDoc AQUI TAMBÉM
};