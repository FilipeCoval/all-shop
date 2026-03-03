import React, { useState, useEffect, useRef } from 'react';
import { X, Gift, Sparkles, Loader2, PartyPopper } from 'lucide-react';
import { User } from '../types';
import { db } from '../services/firebaseConfig';

interface LuckyWheelProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    onUpdateUser: (data: Partial<User>) => void;
}

const PRIZES = [
    { id: '5OFF', label: '5% OFF', color: '#EF4444', probability: 0.3, type: 'coupon', code: 'LUCKY5' },
    { id: 'POINTS100', label: '100 Pontos', color: '#F59E0B', probability: 0.2, type: 'points', value: 100 },
    { id: 'FREESHIP', label: 'Portes Grátis', color: '#10B981', probability: 0.1, type: 'coupon', code: 'FREESHIP' },
    { id: 'LOSE', label: 'Tente de Novo', color: '#6B7280', probability: 0.4, type: 'none' },
];

const LuckyWheel: React.FC<LuckyWheelProps> = ({ isOpen, onClose, user, onUpdateUser }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [result, setResult] = useState<typeof PRIZES[0] | null>(null);
    const [email, setEmail] = useState(user?.email || '');
    const [hasSpun, setHasSpun] = useState(false);
    const wheelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedSpin = localStorage.getItem('lucky_wheel_spun');
        if (savedSpin) {
            setHasSpun(true);
        }
    }, []);

    const spinWheel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSpinning || hasSpun) return;

        if (!email.includes('@')) {
            alert("Por favor, introduza um email válido.");
            return;
        }

        setIsSpinning(true);

        // Determine result based on probability
        const rand = Math.random();
        let cumulative = 0;
        let selectedPrize = PRIZES[PRIZES.length - 1];
        
        for (const prize of PRIZES) {
            cumulative += prize.probability;
            if (rand < cumulative) {
                selectedPrize = prize;
                break;
            }
        }

        // Calculate rotation
        // 4 segments = 90deg each.
        // Index 0 (5% OFF) needs to land at top.
        // If 0 is at 0deg, and pointer is at top (0deg).
        // To land on index i, we need to rotate:
        // Total rotations (5 * 360) + (360 - (i * 90) + offset)
        
        const prizeIndex = PRIZES.findIndex(p => p.id === selectedPrize.id);
        const segmentAngle = 360 / PRIZES.length;
        // Random offset within segment to look natural
        const randomOffset = Math.floor(Math.random() * (segmentAngle - 10)) + 5; 
        
        // Calculate target angle to land the specific segment at the top (pointer)
        // Note: CSS rotate starts at 0 (top).
        // If we want segment 0 at top, rotation is 0.
        // If we want segment 1 at top (90deg clockwise from 0), we need to rotate -90deg (or 270).
        const targetAngle = (360 - (prizeIndex * segmentAngle)) + 360 * 5 + randomOffset;

        if (wheelRef.current) {
            wheelRef.current.style.transition = 'transform 5s cubic-bezier(0.25, 0.1, 0.25, 1)';
            wheelRef.current.style.transform = `rotate(${targetAngle}deg)`;
        }

        setTimeout(async () => {
            setResult(selectedPrize);
            setIsSpinning(false);
            setHasSpun(true);
            localStorage.setItem('lucky_wheel_spun', 'true');

            // Save email lead
            try {
                await db.collection('leads').add({
                    email,
                    prize: selectedPrize.label,
                    date: new Date().toISOString()
                });

                if (selectedPrize.type === 'points' && user?.uid) {
                    onUpdateUser({ loyaltyPoints: (user.loyaltyPoints || 0) + selectedPrize.value });
                }
            } catch (err) {
                console.error("Error saving lead:", err);
            }

        }, 5000);
    };

    if (!isOpen && !result) return null; // Only hide if closed AND no result shown (to allow showing result after spin even if "closed" logic triggers)
    // Actually, controlled by parent. If parent says closed, we close.
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden relative border-4 border-yellow-400">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 z-10">
                    <X size={24} />
                </button>

                {!result ? (
                    <div className="p-8 text-center">
                        <div className="mb-6">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Roda da Sorte! 🍀</h2>
                            <p className="text-gray-500 dark:text-gray-400">Gire a roda e ganhe prémios exclusivos na sua primeira visita.</p>
                        </div>

                        <div className="relative w-64 h-64 mx-auto mb-8">
                            {/* Pointer */}
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 w-8 h-8 bg-yellow-500 rotate-45 border-4 border-white dark:border-gray-800 shadow-lg"></div>
                            
                            {/* Wheel */}
                            <div 
                                ref={wheelRef}
                                className="w-full h-full rounded-full border-8 border-yellow-400 shadow-xl overflow-hidden relative"
                                style={{ transform: 'rotate(0deg)' }}
                            >
                                {PRIZES.map((prize, index) => (
                                    <div 
                                        key={prize.id}
                                        className="absolute w-full h-full top-0 left-0"
                                        style={{ 
                                            transform: `rotate(${index * (360 / PRIZES.length)}deg)`,
                                            clipPath: 'polygon(50% 50%, 100% 0, 100% 100%, 50% 50%)' // This clip path is tricky for 4 segments.
                                            // Better approach for 4 segments:
                                            // Segment 1: Top-Right
                                            // Segment 2: Bottom-Right
                                            // ...
                                        }}
                                    >
                                        {/* Using a simpler CSS Conic Gradient approach for the background might be easier, 
                                            but let's try to position divs. 
                                            Actually, for 4 segments, it's just 4 quadrants.
                                        */}
                                    </div>
                                ))}
                                {/* Fallback visual wheel using conic-gradient */}
                                <div className="absolute inset-0 w-full h-full" style={{
                                    background: `conic-gradient(
                                        ${PRIZES[0].color} 0deg 90deg, 
                                        ${PRIZES[1].color} 90deg 180deg, 
                                        ${PRIZES[2].color} 180deg 270deg, 
                                        ${PRIZES[3].color} 270deg 360deg
                                    )`
                                }}></div>
                                
                                {/* Labels */}
                                {PRIZES.map((prize, index) => (
                                    <div 
                                        key={prize.id}
                                        className="absolute top-1/2 left-1/2 w-full h-full origin-top-left flex justify-center pt-4"
                                        style={{ 
                                            transform: `rotate(${index * 90 + 45}deg) translate(0, -50%)`, // Center in segment
                                            // This transform logic is complex. Let's simplify:
                                            // Just place text at 45, 135, 225, 315 degrees.
                                        }}
                                    >
                                         {/* Text positioning is hard with pure CSS rotation. 
                                             Let's just put icons/text roughly in place.
                                         */}
                                    </div>
                                ))}
                                {/* Simple Labels Overlay */}
                                <div className="absolute inset-0 pointer-events-none">
                                    <span className="absolute top-[15%] right-[15%] text-white font-bold text-xs rotate-45">{PRIZES[0].label}</span>
                                    <span className="absolute bottom-[15%] right-[15%] text-white font-bold text-xs rotate-[135deg]">{PRIZES[1].label}</span>
                                    <span className="absolute bottom-[15%] left-[15%] text-white font-bold text-xs rotate-[225deg]">{PRIZES[2].label}</span>
                                    <span className="absolute top-[15%] left-[15%] text-white font-bold text-xs rotate-[315deg]">{PRIZES[3].label}</span>
                                </div>
                            </div>
                            
                            {/* Center Hub */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center z-10">
                                <Sparkles size={20} className="text-yellow-500" />
                            </div>
                        </div>

                        {!hasSpun ? (
                            <form onSubmit={spinWheel} className="space-y-4">
                                <input 
                                    type="email" 
                                    placeholder="O seu melhor email..." 
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={!!user?.email}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center font-medium outline-none focus:ring-2 focus:ring-yellow-400"
                                />
                                <button 
                                    type="submit" 
                                    disabled={isSpinning}
                                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-black py-4 rounded-xl shadow-lg shadow-yellow-400/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {isSpinning ? <Loader2 className="animate-spin" /> : <><Gift size={20} /> GIRAR AGORA!</>}
                                </button>
                                <p className="text-xs text-gray-400">Ao girar, aceita receber novidades da AllShop.</p>
                            </form>
                        ) : (
                            <p className="text-gray-500 font-bold">A processar...</p>
                        )}
                    </div>
                ) : (
                    <div className="p-10 text-center animate-fade-in">
                        <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                            <PartyPopper size={48} className="text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                            {result.type === 'none' ? 'Oh não! 😢' : 'Parabéns! 🎉'}
                        </h3>
                        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                            {result.type === 'none' ? 'Não ganhou desta vez. Tente na próxima!' : <>Ganhou <strong>{result.label}</strong>!</>}
                        </p>

                        {result.code && (
                            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 mb-6">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">O seu código:</p>
                                <p className="text-2xl font-mono font-bold text-primary select-all">{result.code}</p>
                            </div>
                        )}

                        {result.type === 'points' && (
                            <p className="text-sm text-green-600 font-bold mb-6">Os pontos foram adicionados à sua conta!</p>
                        )}

                        <button onClick={onClose} className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3 rounded-xl">
                            Continuar a Comprar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LuckyWheel;
