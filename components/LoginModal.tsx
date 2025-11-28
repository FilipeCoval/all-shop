
import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { User as UserType } from '../types';
import { auth, db } from '../services/firebaseConfig';
// import { ... } from 'firebase/auth'; // v9 removed
// import { doc, setDoc, getDoc } from 'firebase/firestore'; // v9 removed

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserType) => void;
}

type ModalView = 'login' | 'register' | 'forgot-password';

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [view, setView] = useState<ModalView>('login');
  
  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UX States
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView('login');
      setError(null);
      setSuccessMsg(null);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- LOGIN REAL ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const firebaseUser = userCredential.user;

        if (!firebaseUser) throw new Error("Falha ao obter utilizador");

        // Buscar dados extra (como moradas) da base de dados
        const docRef = db.collection("users").doc(firebaseUser.uid);
        const docSnap = await docRef.get();
        
        let userData: UserType;
        
        if (docSnap.exists) {
            userData = docSnap.data() as UserType;
        } else {
            // Fallback se não houver dados no Firestore
            userData = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Cliente',
                email: firebaseUser.email || '',
                addresses: []
            };
            setUser(userData); // Atualizar na base de dados se faltar
        }

        onLogin(userData);
        onClose();

    } catch (err: any) {
        console.error("Login error", err);
        // Tratamento robusto para auth/invalid-credential (Firebase Auth atual) e user-not-found (Legacy)
        if (
            err.code === 'auth/invalid-credential' || 
            err.code === 'auth/user-not-found' || 
            err.code === 'auth/wrong-password'
        ) {
            setError('Dados incorretos. Se ainda não tem conta, por favor REGISTE-SE primeiro.');
        } else if (err.code === 'auth/too-many-requests') {
            setError('Muitas tentativas falhadas. Tente novamente mais tarde.');
        } else {
            setError('Ocorreu um erro ao entrar (' + (err.code || 'desconhecido') + '). Tente novamente.');
        }
    } finally {
        setIsLoading(false);
    }
  };

  // Helper para criar user se não existir no Firestore mas existir no Auth
  const setUser = async (user: UserType) => {
      if(user.uid) {
          try {
             await db.collection("users").doc(user.uid).set(user, { merge: true });
          } catch(e) { console.error(e); }
      }
  };

  // --- REGISTO REAL ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
        setError('A palavra-passe deve ter pelo menos 6 caracteres.');
        return;
    }

    if (password !== confirmPassword) {
        setError('As palavras-passe não coincidem.');
        return;
    }

    setIsLoading(true);

    try {
        // 1. Criar conta no Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const firebaseUser = userCredential.user;

        if (!firebaseUser) throw new Error("Falha ao criar utilizador");

        // 2. Atualizar nome de exibição
        await firebaseUser.updateProfile({ displayName: name });

        // 3. Criar documento na Base de Dados Real
        const newUser: UserType = {
            uid: firebaseUser.uid,
            name,
            email,
            addresses: []
        };

        await db.collection("users").doc(firebaseUser.uid).set(newUser);

        onLogin(newUser);
        onClose();

    } catch (err: any) {
        console.error("Register error", err);
        if (err.code === 'auth/email-already-in-use') {
            setError('Este email já está registado. Tente fazer login.');
        } else if (err.code === 'auth/weak-password') {
            setError('A palavra-passe é muito fraca. Escolha uma mais segura.');
        } else {
            setError('Erro ao criar conta: ' + err.message);
        }
    } finally {
        setIsLoading(false);
    }
  };

  // --- RECUPERAÇÃO DE PASSWORD REAL ---
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
        await auth.sendPasswordResetEmail(email);
        setSuccessMsg(`Email de recuperação enviado para ${email}. Verifique a sua caixa de entrada (e spam).`);
        setTimeout(() => setView('login'), 5000);
    } catch (err: any) {
        console.error("Reset error", err);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
            setError('Email inválido ou não registado.');
        } else {
            setError('Erro ao enviar email. Tente novamente.');
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {view === 'login' && 'Bem-vindo'}
              {view === 'register' && 'Criar Conta'}
              {view === 'forgot-password' && 'Recuperar Conta'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={24} />
            </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-0 overflow-y-auto">
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 animate-slide-in">
                    <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {successMsg && (
                <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3 text-green-700 animate-slide-in">
                    <CheckCircle size={20} className="mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">{successMsg}</span>
                </div>
            )}

            {view === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">Palavra-passe</label>
                            <button 
                                type="button" 
                                onClick={() => setView('forgot-password')}
                                className="text-xs font-semibold text-primary hover:underline"
                            >
                                Esqueceu-se?
                            </button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="••••••••"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'A entrar...' : 'Entrar'} <ArrowRight size={20} />
                    </button>

                    <div className="text-center pt-4 border-t border-gray-100 mt-6">
                        <span className="text-gray-600 text-sm">Não tem conta? </span>
                        <button 
                            type="button" 
                            onClick={() => setView('register')}
                            className="text-primary font-bold text-sm hover:underline"
                        >
                            Registar Agora
                        </button>
                    </div>
                </form>
            )}

            {view === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input 
                            type="text" 
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="João Silva"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="seu@email.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Palavra-passe</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="Mínimo 6 caracteres"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Palavra-passe</label>
                        <input 
                            type="password" 
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="Repita a palavra-passe"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-secondary hover:bg-gray-800 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'A criar conta...' : 'Criar Conta'}
                    </button>

                    <div className="text-center pt-4 border-t border-gray-100 mt-6">
                        <span className="text-gray-600 text-sm">Já tem conta? </span>
                        <button 
                            type="button" 
                            onClick={() => setView('login')}
                            className="text-primary font-bold text-sm hover:underline"
                        >
                            Fazer Login
                        </button>
                    </div>
                </form>
            )}

            {view === 'forgot-password' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-gray-600 text-sm mb-4">
                        Insira o seu email. Vamos enviar-lhe um link oficial para redefinir a sua palavra-passe com segurança.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'A enviar...' : 'Enviar Email de Recuperação'}
                    </button>

                    <button 
                        type="button" 
                        onClick={() => setView('login')}
                        className="w-full text-gray-500 font-medium text-sm hover:text-gray-700 mt-4"
                    >
                        Voltar ao Login
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

