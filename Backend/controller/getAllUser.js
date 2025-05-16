import User from "../models/userModel.js";

const EXCLUDE_FIELDS = '-password';

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, EXCLUDE_FIELDS);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
};

export default getAllUsers;
