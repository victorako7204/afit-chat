const Library = require('../models/Library');
const { cloudinary } = require('../config/cloudinary');

const uploadResource = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, description, department } = req.body;

    const resource = new Library({
      title,
      description: description || '',
      fileUrl: req.file.path,
      publicId: req.file.filename,
      department,
      uploadedBy: req.user._id,
      fileName: req.file.originalname
    });

    await resource.save();

    res.status(201).json({
      message: 'Resource uploaded successfully',
      resource
    });
  } catch (error) {
    next(error);
  }
};

const getResources = async (req, res, next) => {
  try {
    const { department } = req.query;
    const query = department ? { department } : {};

    const resources = await Library.find(query)
      .populate('uploadedBy', 'name matricNo')
      .sort({ createdAt: -1 });

    res.json(resources);
  } catch (error) {
    next(error);
  }
};

const getResource = async (req, res, next) => {
  try {
    const resource = await Library.findById(req.params.id)
      .populate('uploadedBy', 'name matricNo');

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    res.json(resource);
  } catch (error) {
    next(error);
  }
};

const deleteResource = async (req, res, next) => {
  try {
    const resource = await Library.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    if (resource.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await cloudinary.uploader.destroy(resource.publicId, { resource_type: 'raw' });
    await Library.findByIdAndDelete(req.params.id);

    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getDepartments = async (req, res, next) => {
  try {
    const departments = await Library.distinct('department');
    res.json(departments);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadResource,
  getResources,
  getResource,
  deleteResource,
  getDepartments
};
