CREATE TABLE students(id TEXT PRIMARY KEY, ch TEXT UNIQUE, created INT, seen INT, answered INT DEFAULT 0, data TEXT DEFAULT '{}');
CREATE TABLE sessions(h TEXT PRIMARY KEY, student TEXT, exp INT);
CREATE TABLE tries(k TEXT PRIMARY KEY, n INT, t INT);
CREATE TABLE hits(day TEXT, vh TEXT, env TEXT, PRIMARY KEY(day, vh, env));
