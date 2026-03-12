const Company = require('../models/Company');
const User = require('../models/User');
const crypto = require('crypto');
const { sendTeamNotification } = require('../services/teamEmailService');

// Create company
exports.createCompany = async (req, res) => {
    try {
        const { name, description, industry, website, size, visibility, departments } = req.body;
        if (!name) return res.status(400).json({ error: 'Company name is required' });

        const company = new Company({
            name,
            description: description || '',
            industry: industry || '',
            website: website || '',
            size: size || '1-10',
            visibility: visibility || 'private',
            departments: departments || [],
            createdBy: req.user._id,
            employees: [{
                email: req.user.email,
                userId: req.user._id,
                name: req.user.name || '',
                role: 'ceo',
                department: 'Management',
                status: 'active',
                joinedAt: new Date()
            }]
        });

        await company.save();
        res.json({ success: true, company });
    } catch (err) {
        console.error('[Company] Create error:', err);
        res.status(500).json({ error: 'Failed to create company' });
    }
};

// Get my companies
exports.getMyCompanies = async (req, res) => {
    try {
        const companies = await Company.find({
            $or: [
                { createdBy: req.user._id },
                { 'employees.email': req.user.email, 'employees.status': { $ne: 'removed' } }
            ]
        }).sort({ updatedAt: -1 });

        res.json({ success: true, companies });
    } catch (err) {
        console.error('[Company] Get companies error:', err);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};

// Get public companies
exports.getPublicCompanies = async (req, res) => {
    try {
        const companies = await Company.find({ visibility: 'public' })
            .sort({ updatedAt: -1 })
            .select('name description industry size employees.length createdAt');
        res.json({ success: true, companies });
    } catch (err) {
        console.error('[Company] Get public companies error:', err);
        res.status(500).json({ error: 'Failed to fetch public companies' });
    }
};

// Get single company
exports.getCompany = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const isEmployee = company.employees.some(e => e.email === req.user.email && e.status !== 'removed');
        if (company.visibility === 'private' && !isEmployee) {
            return res.status(403).json({ error: 'Access denied. This is a private company.' });
        }

        const currentEmployee = company.employees.find(e => e.email === req.user.email);
        res.json({ success: true, company, myRole: currentEmployee?.role || null });
    } catch (err) {
        console.error('[Company] Get company error:', err);
        res.status(500).json({ error: 'Failed to fetch company' });
    }
};

// Update company
exports.updateCompany = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const employee = company.employees.find(e => e.email === req.user.email);
        if (!employee || !['ceo', 'hr', 'manager'].includes(employee.role)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const { name, description, industry, website, size, visibility, departments, settings } = req.body;
        if (name) company.name = name;
        if (description !== undefined) company.description = description;
        if (industry !== undefined) company.industry = industry;
        if (website !== undefined) company.website = website;
        if (size) company.size = size;
        if (visibility) company.visibility = visibility;
        if (departments) company.departments = departments;
        if (settings) company.settings = { ...company.settings.toObject(), ...settings };

        await company.save();
        res.json({ success: true, company });
    } catch (err) {
        console.error('[Company] Update error:', err);
        res.status(500).json({ error: 'Failed to update company' });
    }
};

// Delete company
exports.deleteCompany = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        if (company.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only company creator can delete' });
        }

        await Company.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[Company] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete company' });
    }
};

// Add employee
exports.addEmployee = async (req, res) => {
    try {
        const { email, role, department } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        // Check permission (CEO, HR, Manager)
        const requester = company.employees.find(e => e.email === req.user.email);
        if (!requester || !['ceo', 'hr', 'manager'].includes(requester.role)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const existing = company.employees.find(e => e.email === email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'Employee already exists' });
        }

        const user = await User.findOne({ email });

        if (existing && existing.status === 'removed') {
            existing.status = 'pending';
            existing.role = role || 'employee';
            existing.department = department || '';
            existing.userId = user?._id || null;
            existing.name = user?.name || '';
        } else {
            company.employees.push({
                email,
                userId: user?._id || null,
                name: user?.name || '',
                role: role || 'employee',
                department: department || '',
                status: 'pending'
            });
        }

        await company.save();

        try {
            await sendTeamNotification(email, company.name, req.user.name || req.user.email, 'company');
        } catch (emailErr) {
            console.error('[Company] Email notification failed:', emailErr.message);
        }

        res.json({ success: true, company });
    } catch (err) {
        console.error('[Company] Add employee error:', err);
        res.status(500).json({ error: 'Failed to add employee' });
    }
};

// Remove employee
exports.removeEmployee = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const requester = company.employees.find(e => e.email === req.user.email);
        if (!requester || !['ceo', 'hr'].includes(requester.role)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const employee = company.employees.find(e => e.email === email);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        if (employee.role === 'ceo') return res.status(400).json({ error: 'Cannot remove CEO' });

        employee.status = 'removed';
        await company.save();
        res.json({ success: true, company });
    } catch (err) {
        console.error('[Company] Remove employee error:', err);
        res.status(500).json({ error: 'Failed to remove employee' });
    }
};

// Update employee role
exports.updateEmployeeRole = async (req, res) => {
    try {
        const { email, role, department } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const requester = company.employees.find(e => e.email === req.user.email);
        if (!requester || !['ceo', 'hr'].includes(requester.role)) {
            return res.status(403).json({ error: 'Only CEO or HR can change roles' });
        }

        const employee = company.employees.find(e => e.email === email);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        if (role) employee.role = role;
        if (department !== undefined) employee.department = department;
        await company.save();
        res.json({ success: true, company });
    } catch (err) {
        console.error('[Company] Update role error:', err);
        res.status(500).json({ error: 'Failed to update role' });
    }
};

// Share meeting in company
exports.shareMeetingLink = async (req, res) => {
    try {
        const { link, title, scheduledTime, platform, department } = req.body;
        if (!link) return res.status(400).json({ error: 'Meeting link is required' });

        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        company.meetingLinks.push({
            link,
            title: title || 'Company Meeting',
            scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
            platform: platform || 'unknown',
            department: department || '',
            addedBy: req.user._id
        });

        await company.save();

        // Email active employees
        if (company.settings.emailNotifications) {
            let targetEmployees = company.employees.filter(e => e.status === 'active' && e.email !== req.user.email);
            if (department) {
                targetEmployees = targetEmployees.filter(e => e.department === department);
            }
            for (const emp of targetEmployees) {
                try {
                    await sendTeamNotification(
                        emp.email, company.name, req.user.name || req.user.email,
                        'meeting', { link, title: title || 'Company Meeting', scheduledTime }
                    );
                } catch (emailErr) {
                    console.error('[Company] Meeting email failed for:', emp.email);
                }
            }
        }

        res.json({ success: true, company });
    } catch (err) {
        console.error('[Company] Share meeting error:', err);
        res.status(500).json({ error: 'Failed to share meeting link' });
    }
};

// Join public company
exports.joinCompany = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });
        if (company.visibility !== 'public') {
            return res.status(403).json({ error: 'This company is private. Use an invite code to join.' });
        }

        const existing = company.employees.find(e => e.email === req.user.email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'Already an employee' });
        }

        if (existing && existing.status === 'removed') {
            existing.status = 'active';
            existing.userId = req.user._id;
            existing.name = req.user.name || '';
        } else {
            company.employees.push({
                email: req.user.email,
                userId: req.user._id,
                name: req.user.name || '',
                role: 'employee',
                status: 'active'
            });
        }

        await company.save();
        res.json({ success: true, company });
    } catch (err) {
        console.error('[Company] Join error:', err);
        res.status(500).json({ error: 'Failed to join company' });
    }
};

// Join by invite code (works for private companies)
exports.joinByCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Invite code is required' });

        const company = await Company.findOne({ inviteCode: code.trim().toLowerCase() });
        if (!company) return res.status(404).json({ error: 'Invalid invite code' });

        const existing = company.employees.find(e => e.email === req.user.email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'Already an employee' });
        }

        if (existing && existing.status === 'removed') {
            existing.status = 'active';
            existing.userId = req.user._id;
            existing.name = req.user.name || '';
        } else {
            company.employees.push({
                email: req.user.email,
                userId: req.user._id,
                name: req.user.name || '',
                role: 'employee',
                status: 'active'
            });
        }

        await company.save();
        res.json({ success: true, company, entityType: 'company' });
    } catch (err) {
        console.error('[Company] Join by code error:', err);
        res.status(500).json({ error: 'Failed to join' });
    }
};

// Regenerate invite code
exports.regenerateCode = async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const employee = company.employees.find(e => e.email === req.user.email);
        if (!employee || !['ceo', 'hr'].includes(employee.role)) {
            return res.status(403).json({ error: 'Only CEO or HR can regenerate code' });
        }

        company.inviteCode = crypto.randomBytes(4).toString('hex');
        await company.save();
        res.json({ success: true, inviteCode: company.inviteCode });
    } catch (err) {
        console.error('[Company] Regenerate code error:', err);
        res.status(500).json({ error: 'Failed to regenerate code' });
    }
};
