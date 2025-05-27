import mongoose from "mongoose";

const countrySchema = new mongoose.Schema(
  {
    image: { type: String },
    title: { type: String },
    president: { type: String },
    independence_date: { type: String },
    capital: { type: String },
    currency: { type: String },
    population: { type: String },
    demonym: { type: String },
    description: { type: String },
    language: { type: String },
    arts_and_crafts: { type: String },
    cultural_dance: { type: String, default: "" }, // Optional field
    time_zone: { type: String, default: "" }, // Optional field
    link: { type: String, default: "" }, // Optional field
    created_by_id: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

const Country = mongoose.model("Country", countrySchema);
export default Country;