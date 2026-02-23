import { Mongo } from "meteor/mongo";

// Guard against double-instantiation (Meteor + rspack both load this module)
export const ApprovalTokens = (globalThis.__collections_approvalTokens ??=
  new Mongo.Collection("approvalTokens"));
