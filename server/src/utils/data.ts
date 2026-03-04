import { readFileSync, writeFileSync, accessSync, constants } from "node:fs";
// import { join } from "node:path";

/**
 * 通用数据管理类
 * 支持自动持久化和响应式更新
 */
export class DataManager<T = any> {
    private filePath: string;
    private data: T;
    private proxy: T;

    constructor(filePath: string, defaultData: T) {
        this.filePath = filePath;
        this.initializeData(defaultData);
        this.proxy = this.createProxy(this.data);
    }

    /**
     * 初始化数据，如果文件不存在则创建默认数据
     */
    private initializeData(defaultData: T): void {
        try {
            // 检查文件是否存在且可读写
            accessSync(this.filePath, constants.R_OK | constants.W_OK);
            this.data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        } catch (err) {
            // 文件不存在或无法访问，创建默认数据
            this.data = JSON.parse(JSON.stringify(defaultData)); // 深拷贝默认数据
            this.saveData();
        }
    }

    /**
     * 创建响应式代理
     */
    private createProxy(target: any): any {
        const handler: ProxyHandler<any> = {
            set: (target, key, value): boolean => {
                target[key] = value;
                this.saveData();
                return true;
            },
            get: (target, key): any => {
                const res = target[key];
                return typeof res === 'object' && res !== null 
                    ? new Proxy(res, handler) 
                    : res;
            }
        };

        return new Proxy(target, handler);
    }

    /**
     * 保存数据到文件
     */
    private saveData(): void {
        try {
            writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error('保存数据失败:', err);
        }
    }

    /**
     * 获取响应式数据对象
     */
    public getData(): T {
        return this.proxy;
    }

    /**
     * 获取原始数据对象（非代理）
     */
    public getRawData(): T {
        return this.data;
    }

    /**
     * 更新数据
     */
    public updateData(newData: Partial<T>): void {
        Object.assign(this.data, newData);
        this.saveData();
    }

    /**
     * 重置数据为默认值
     */
    public resetData(defaultData: T): void {
        this.data = JSON.parse(JSON.stringify(defaultData));
        this.proxy = this.createProxy(this.data);
        this.saveData();
    }

    /**
     * 重新加载数据文件
     */
    public reload(): void {
        try {
            this.data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
            this.proxy = this.createProxy(this.data);
        } catch (err) {
            console.error('重新加载数据失败:', err);
        }
    }
}