import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Loader2, TrendingUp, Users } from 'lucide-react';
import { getAnalyticsData, DailyStats } from '../services/analyticsService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AnalyticsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose }) => {
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
    const [data, setData] = useState<DailyStats[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, period]);

    const fetchData = async () => {
        setLoading(true);
        // Map period to days
        let days = 7;
        if (period === 'daily') days = 7;
        if (period === 'weekly') days = 30;
        if (period === 'monthly') days = 90;
        if (period === 'yearly') days = 365;

        const stats = await getAnalyticsData(days);
        // Sort by date ascending for chart
        setData(stats.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setLoading(false);
    };

    // Aggregate locations
    const locationStats = React.useMemo(() => {
        const locs: Record<string, number> = {};
        data.forEach(day => {
            Object.entries(day.locations || {}).forEach(([loc, count]) => {
                locs[loc] = (locs[loc] || 0) + count;
            });
        });
        return Object.entries(locs)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10); // Top 10
    }, [data]);

    const totalVisitsPeriod = data.reduce((acc, curr) => acc + curr.totalVisits, 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                    <div>
                        <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                            <TrendingUp className="text-blue-600" /> Análise de Tráfego
                        </h3>
                        <p className="text-sm text-gray-500">Monitorização de visitantes e origem geográfica.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
                    {/* Controls */}
                    <div className="flex justify-between items-center">
                        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                                        period === p 
                                            ? 'bg-blue-600 text-white shadow' 
                                            : 'text-gray-500 hover:bg-gray-50'
                                    }`}
                                >
                                    {p === 'daily' ? '7 Dias' : p === 'weekly' ? '30 Dias' : p === 'monthly' ? '3 Meses' : 'Ano'}
                                </button>
                            ))}
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase font-bold">Total no Período</p>
                            <p className="text-2xl font-bold text-gray-900">{totalVisitsPeriod}</p>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <Loader2 className="animate-spin" size={32} />
                            </div>
                        ) : data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                        stroke="#9ca3af"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis 
                                        stroke="#9ca3af" 
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="totalVisits" 
                                        stroke="#2563eb" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill="url(#colorVisits)" 
                                        name="Visitas"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 italic">
                                Sem dados para este período.
                            </div>
                        )}
                    </div>

                    {/* Locations */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <MapPin className="text-red-500" size={20} /> Origem do Tráfego (Top 10)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {locationStats.map(([location, count], idx) => (
                                <div key={location} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-200">
                                            {idx + 1}
                                        </span>
                                        <span className="font-medium text-gray-700">{location}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users size={14} className="text-gray-400" />
                                        <span className="font-bold text-gray-900">{count}</span>
                                    </div>
                                </div>
                            ))}
                            {locationStats.length === 0 && (
                                <p className="text-gray-400 italic col-span-2 text-center py-4">Sem dados de localização registados.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsModal;
