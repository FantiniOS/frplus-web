'use server';

export async function getBase64ImageServer(url: string) {
    try {
        if (!url) return null;
        
        // Handle absolute vs relative URLs robustly
        let fetchUrl = url;
        if (!url.startsWith('http')) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            fetchUrl = `${baseUrl}/${url.replace(/^\//, '')}`;
        }

        const response = await fetch(fetchUrl);
        
        if (!response.ok) {
            console.error(`Fetch failed on server: ${fetchUrl} - Status: ${response.status}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const contentType = response.headers.get('content-type') || 'image/png';
        
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error("Error fetching image on Server Action:", error);
        return null;
    }
}
