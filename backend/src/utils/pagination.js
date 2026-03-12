const paginate = (query) => {
    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(parseInt(query.limit, 10) || 20, 100);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};

const paginationMeta = (total, page, limit) => {
    const totalPages = Math.ceil(total / limit);
    return {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    };
};

module.exports = { paginate, paginationMeta };
