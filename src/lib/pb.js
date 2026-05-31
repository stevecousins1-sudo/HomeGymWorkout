import PocketBase from 'pocketbase';

const pbUrl = import.meta.env.VITE_PB_URL || 'http://localhost:8090';
console.log('[PocketBase] connecting to:', pbUrl);

const pb = new PocketBase(pbUrl);

export default pb;
