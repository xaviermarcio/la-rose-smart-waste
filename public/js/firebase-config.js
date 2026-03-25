import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    writeBatch, 
    doc,
    getDocs,
    query,
    orderBy,
    updateDoc // ADICIONADO: Extremamente necessário para o "Dar Baixa" no Admin!
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// SUAS CHAVES REAIS DA LA ROSE
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "l",
    messagingSenderId: "3",
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