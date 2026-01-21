import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight, WifiOff, Copy } from 'lucide-react';
import { User as UserType } from '../types';
import { auth, db } from '../services/firebaseConfig';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserType) => void;
}

type ModalView = 'login' | 'register' | 'forgot-password';

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [view, setView] = useState<ModalView>('login');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigError, setIsConfigError] = useState(false); // Novo estado para erros de configuração
  const [blockedDomain, setBlockedDomain] = useState<string>(''); // Para mostrar o domínio exato
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView('login');
      setError(null);
      setIsConfigError(false);
      setBlockedDomain('');
      setSuccessMsg(null);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Função auxiliar para extrair o domínio do erro
  const handleAuthError = (err: any) => {
      console.error("Auth error", err);
      const errorMessage = err.message || '';
      
      // Deteta erro de referer (Domínio bloqueado)
      if (errorMessage.includes('requests-from-referer') || errorMessage.includes('403')) {
          // Tenta extrair o domínio exato que veio no erro
          const matches = errorMessage.match(/requests-from-referer-(.*?)-are-blocked/);
          
          // Se conseguir extrair do erro, usa. Se não, usa o domínio atual do browser (seguro para mobile).
          const domain = matches ? matches[1] : window.location.origin;
          
          setBlockedDomain(domain);
          setError('Domínio não autorizado (Erro 403).');
          setIsConfigError(true);
      } else if (
          err.code === 'auth/invalid-credential' || 
          err.code === 'auth/user-not-found' || 
          err.code === 'auth/wrong-password'
      ) {
          setError('Dados incorretos. Verifique o email e palavra-passe.');
      } else if (err.code === 'auth/too-many-requests') {
          setError('Muitas tentativas falhadas. Tente novamente mais tarde.');
      } else if (err.code === 'auth/email-already-in-use') {
          setError('Este email já está registado.');
      } else if (err.code === 'auth/operation-not-allowed') {
          setError('Erro de configuração: Login por email/password não está ativo no Firebase.');
      } else {
          setError('Ocorreu um erro inesperado: ' + errorMessage);
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsConfigError(false);
    setIsLoading(true);

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email.trim(), password);
        const firebaseUser = userCredential.user;

        if (!firebaseUser) throw new Error("Falha ao obter utilizador");

        let userData: UserType;
        
        try {
            // Tentar buscar dados extra da base de dados
            const docRef = db.collection("users").doc(firebaseUser.uid);
            const docSnap = await docRef.get();
            
            if (docSnap.exists) {
                userData = docSnap.data() as UserType;
            } else {
                userData = {
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName || 'Cliente',
                    email: firebaseUser.email || '',
                    addresses: []
                };
            }
        } catch (dbErr) {
            console.warn("Database restricted. Using Auth profile only.");
            userData = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Cliente',
                email: firebaseUser.email || '',
                addresses: []
            };
        }

        onLogin(userData);
        onClose();

    } catch (err: any) {
        handleAuthError(err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsConfigError(false);

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
        const userCredential = await auth.createUserWithEmailAndPassword(email.trim(), password);
        const firebaseUser = userCredential.user;

        if (!firebaseUser) throw new Error("Falha ao criar utilizador");

        await firebaseUser.updateProfile({ displayName: name });

        const newUser: UserType = {
            uid: firebaseUser.uid,
            name,
            email: email.trim(),
            addresses: []
        };

        try {
            await db.collection("users").doc(firebaseUser.uid).set(newUser);
        } catch(e) { console.debug("Database sync on register restricted."); }

        onLogin(newUser);
        onClose();

    } catch (err: any) {
        handleAuthError(err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsConfigError(false);
    setIsLoading(true);

    try {
        await auth.sendPasswordResetEmail(email.trim());
        setSuccessMsg(`Email de recuperação enviado para ${email.trim()}.`);
        setTimeout(() => setView('login'), 5000);
    } catch (err: any) {
        handleAuthError(err);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
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

        <div className="p-8 pt-0 overflow-y-auto">
            {error && (
                <div className={`mb-6 p-4 border rounded-xl flex flex-col gap-2 ${isConfigError ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-red-50 border-red-100 text-red-600'} animate-slide-in`}>
                    <div className="flex items-start gap-3">
                        {isConfigError ? <WifiOff size={20} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />}
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    {isConfigError && blockedDomain && (
                        <div className="pl-8 text-xs text-orange-700">
                            <p className="mb-1"><strong>Copie este link e adicione como "*Link*" na Google Cloud:</strong></p>
                            <div className="flex items-center gap-2 bg-white/50 p-2 rounded border border-orange-200">
                                <code className="flex-1 break-all select-all font-mono text-[10px]">{blockedDomain}</code>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(blockedDomain)}
                                    className="p-1 hover:bg-orange-200 rounded text-orange-800"
                                    title="Copiar"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                            <p className="mt-2 text-[10px] text-gray-500 italic">Dica: Adicione <strong>*.goog/*</strong> na Cloud para corrigir de vez.</p>
                        </div>
                    )}
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
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="seu@email.com" />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">Palavra-passe</label>
                            <button type="button" onClick={() => setView('forgot-password')} className="text-xs font-semibold text-primary hover:underline">Esqueceu-se?</button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="••••••••" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70">
                        {isLoading ? 'A entrar...' : 'Entrar'} <ArrowRight size={20} />
                    </button>
                    <div className="text-center pt-4 border-t border-gray-100 mt-6">
                        <span className="text-gray-600 text-sm">Não tem conta? </span>
                        <button type="button" onClick={() => setView('register')} className="text-primary font-bold text-sm hover:underline">Registar Agora</button>
                    </div>
                </form>
            )}

            {view === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="João Silva" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="seu@email.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Palavra-passe</label>
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="Mínimo 6 caracteres" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Palavra-passe</label>
                        <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="Repita a palavra-passe" />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-secondary hover:bg-gray-800 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70">
                        {isLoading ? 'A criar conta...' : 'Criar Conta'}
                    </button>
                    <div className="text-center pt-4 border-t border-gray-100 mt-6">
                        <span className="text-gray-600 text-sm">Já tem conta? </span>
                        <button type="button" onClick={() => setView('login')} className="text-primary font-bold text-sm hover:underline">Fazer Login</button>
                    </div>
                </form>
            )}

            {view === 'forgot-password' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-gray-600 text-sm mb-4">Insira o seu email para receber um link de redefinição.</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="seu@email.com" />
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all mt-4 disabled:opacity-70">
                        {isLoading ? 'A enviar...' : 'Enviar Email de Recuperação'}
                    </button>
                    <button type="button" onClick={() => setView('login')} className="w-full text-gray-500 font-medium text-sm hover:text-gray-700 mt-4">Voltar ao Login</button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
