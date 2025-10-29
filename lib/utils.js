import 'dotenv/config';
import chalk from "chalk";
import moment from "moment-timezone";

moment.tz.setDefault('Asia/Jakarta').locale('id');
/**
 * Get text with color
 * @param  {String} text
 * @param  {String} color
 * @return  {String} Return text with color
 */
const color = (text, color) => {
    return !color ? chalk.green(text) : chalk.keyword(color)(text);
};
/**
 * Get Time duration
 * @param  {Date} timestamp
 * @param  {Date} now
 */
const processTime = (timestamp, now) => {
    // timestamp => timestamp when message was received
    return moment.duration(now - moment(timestamp * 1000)).asSeconds();
};
/**
 * is it url?
 * @param  {String} url
 */
const isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,50}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi));
};
// Message Filter / Message Cooldowns
const usedCommandRecently = new Set();
/**
 * Check is number filtered
 * @param  {String} from
 */
const isFiltered = (from) => {
    return !!usedCommandRecently.has(from);
};
/**
 * Add number to filter
 * @param  {String} from
 */
const addFilter = (from, delay) => {
    usedCommandRecently.add(from);
    setTimeout(() => {
        return usedCommandRecently.delete(from);
    }, delay); // 5sec is delay before processing next command
};
const addFilter2 = (from, delay) => {
    usedCommandRecently.add(from);
    setTimeout(() => {
        return usedCommandRecently.delete(from);
    }, delay); // 10sec is delay before processing next command
};

export const msgFilter = {
    isFiltered,
    addFilter,
    addFilter2
};
export { processTime };
export { isUrl };
export { color };
export default {
    msgFilter,
    processTime,
    isUrl,
    color
};
