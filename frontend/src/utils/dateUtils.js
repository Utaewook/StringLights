
export const formatDate = (timestamp) => {
    if (!timestamp) return '-';

    // timestamp might be in seconds (Unix) or milliseconds.
    // Backend often returns seconds (time.time()). JS expects ms.
    // Heuristic: if small number, * 1000
    let date;
    if (typeof timestamp === 'number') {
        if (timestamp < 10000000000) { // likely seconds
            date = new Date(timestamp * 1000);
        } else {
            date = new Date(timestamp);
        }
    } else {
        date = new Date(timestamp);
    }

    const pad = (n) => n.toString().padStart(2, '0');

    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    const ss = pad(date.getSeconds());

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};
