/*
  Warnings:

  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "password" TEXT NOT NULL
);
INSERT INTO "new_User" ("email", "id", "name", "password", "role")
SELECT "email", "id", "name", '$2b$10$PN1C4BDAyHj8CWY/KKTHg.MXbnUsMr1S6K9p66Nk5R8HweqJIVQei', "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
