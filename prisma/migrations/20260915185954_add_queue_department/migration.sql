/*
  Warnings:

  - Added the required column `department` to the `DepartmentQueue` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DepartmentQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT
);
INSERT INTO "new_DepartmentQueue" ("description", "department", "id", "name")
SELECT "description",
       CASE "id"
         WHEN 'queue-1' THEN 'IT'
         WHEN 'queue-2' THEN 'Finance'
       END,
       "id", "name"
FROM "DepartmentQueue";
DROP TABLE "DepartmentQueue";
ALTER TABLE "new_DepartmentQueue" RENAME TO "DepartmentQueue";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
