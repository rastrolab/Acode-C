import fs from "node:fs";
import { initParser } from "../src/core/parser.js";
const dir = new URL("../assets/", import.meta.url);
export const loadAsset = async (name) => fs.readFileSync(new URL(name, dir));
export const ready = initParser(loadAsset);
