// js/radioService.js - النسخة النهائية مع شام FM

export const stations = [
    // 🇸🇾 شام FM (رابط يعمل)
    { 
        name: "🇸🇾 شام FM", 
        url: "http://radioshamfm.grtvstream.com:8400/stream/1/" 
    },
    // 🎤 مصري (نجوم FM)
    { 
        name: "🎤 نجوم FM", 
        url: "https://stream.zeno.fm/0ms1g2tgr18uv" 
    },
    // 🎶 طرب قديم
    { 
        name: "📻 الزمن الجميل", 
        url: "https://radio.mosaiquefm.net/mosatarab" 
    },
    // 🌴 خليجي
    { 
        name: "🌴 خليجي", 
        url: "https://stream.radiojar.com/5wpf9e4erxquv" 
    },    
    // منوعات
    { 
        name: "🎼 منوعات", 
        url: "https://stream.zeno.fm/u1wbm3k7gxquv" 
    }
];

export async function resolveStationUrl(station) {
    if (station && station.url) {
        return station.url;
    }
    return "https://radio.mosaiquefm.net/mosatounsi";
}
