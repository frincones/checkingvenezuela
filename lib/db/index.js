/**
 * Database Operations Index
 *
 * This file exports all database operations.
 * Currently configured for: SUPABASE
 *
 * To switch back to MongoDB, change the imports below.
 */

// SUPABASE CONFIGURATION (current)
export {
  getOneDoc,
  getManyDocs,
  createOneDoc,
  createManyDocs,
  updateOneDoc,
  updateManyDocs,
  deleteOneDoc,
  deleteManyDocs,
  countDocs,
  tableNameMap,
} from "./supabase/operations";

// MongoDB CONFIGURATION (legacy - commented out)
// export { getOneDoc, getManyDocs } from "./getOperationDB";
// export { createOneDoc, createManyDocs } from "./createOperationDB";
// export { updateOneDoc, updateManyDocs } from "./updateOperationDB";
// export { deleteOneDoc, deleteManyDocs } from "./deleteOperationDB";
// export { countDocs } from "./utilsDB";
