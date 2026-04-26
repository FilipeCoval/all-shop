import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { Category } from '../types';

export const useStoreCategories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = db.collection('store_categories').orderBy('order').onSnapshot(
            async (snapshot) => {
                if (snapshot.empty && !loading) {
                    // Seed defaults if empty
                    const defaults: Category[] = [
                        { name: 'TV & Streaming', image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80', order: 1 },
                        { name: 'Cabos', image: 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?auto=format&fit=crop&q=80', order: 2 },
                        { name: 'Acessórios', image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80', order: 3 },
                        { name: 'Audio', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80', order: 4 },
                        { name: 'Adaptadores', image: 'https://images.unsplash.com/photo-1624823183424-df359b83b8b6?auto=format&fit=crop&q=80', order: 5 }
                    ];
                    try {
                        const batch = db.batch();
                        defaults.forEach(cat => {
                            const docRef = db.collection('store_categories').doc();
                            batch.set(docRef, cat);
                        });
                        await batch.commit();
                    } catch (err) {
                        console.error('Error seeding categories:', err);
                    }
                } else {
                    const catsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
                    setCategories(catsData);
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching categories:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return { categories, loading };
};
