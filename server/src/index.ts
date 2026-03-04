import { PORT } from './config.js';
import cors from 'cors';
import { createContext } from './trpc/context.js';
import appRouter from './router/index.js';
import express from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import main from './app/main.js';

// 初始化数据库（在导入报告存储之前）
import { getDatabase } from './utils/db.js';
getDatabase(); // 初始化数据库连接和表结构

// 导入报告存储
import { getReport } from './app/utils/reportStore.js';
import { getReportById, parseProjectInfo } from './utils/reportDbService.js';

const app = express();
app.use(cors())
app.use(express.json())
app.use('/trpc', trpcExpress.createExpressMiddleware({ router: appRouter, createContext }));

// 添加报告查看 API（返回 JSON 数据）
app.get('/api/report/:reportId', (req, res) => {
    const { reportId } = req.params;
    const report = getReportById(reportId);
    
    if (!report) {
        return res.status(404).json({
            success: false,
            message: '报告不存在',
            reportId,
        });
    }
    
    // 返回完整的 JSON 数据
    res.json({
        success: true,
        data: {
            id: report.id,
            projectId: report.projectId,
            commitHash: report.commitHash,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
            executiveSummary: report.executiveSummary,
            tiebaSummary: report.tiebaSummary,
            fullReport: report.fullReport,
            messageId: report.messageId,
            projectInfo: parseProjectInfo(report.projectInfo),
        },
    });
});

app.use(express.static('public'))

// 处理所有未匹配的路由，返回 index.html 用于客户端路由
app.use((req, res, next) => {
    // 跳过 API 路由和静态文件
    if (req.path.startsWith('/trpc') || req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile('public/index.html', { root: '.' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})
main();
// const server = createHTTPServer({
//     router: appRouter,
//     createContext,
//     middleware: cors()
// })
// server.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`)
// })