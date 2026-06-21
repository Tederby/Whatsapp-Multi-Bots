import fs from "fs";
import path from "path";

const dbFile = path.resolve(process.cwd(), "database.json");

export function getDB() {
    if (!fs.existsSync(dbFile)) return { groups: {} };
    try {
        return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
    } catch (e) {
        return { groups: {} };
    }
}

export function saveDB(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), "utf-8");
}

export function getGroupConfig(chatId) {
    const db = getDB();
    if (!db.groups) db.groups = {};
    if (!db.groups[chatId]) db.groups[chatId] = { welcome: false, welcomeText: "", goodbye: false, goodbyeText: "" };
    
    // Backward compatibility
    if (typeof db.groups[chatId].goodbye === "undefined") {
        db.groups[chatId].goodbye = false;
        db.groups[chatId].goodbyeText = "";
    }
    
    return db.groups[chatId];
}

export function saveGroupConfig(chatId, config) {
    const db = getDB();
    if (!db.groups) db.groups = {};
    db.groups[chatId] = config;
    saveDB(db);
}
