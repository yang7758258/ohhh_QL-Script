import os
import requests
import json
import time

#抓包域名https://ys.shajixueyuan.com/api/user_sign/sign
#取url请求中的token，变量名：dfjsck
#变量格式 token#备注，多账号换行或者用@连接

def get_accounts_from_env(var_name):
    """从环境变量中获取账户列表"""
    env_value = os.getenv(var_name)
    if not env_value:
        print(f"没有找到环境变量 '{var_name}'")
        return []
    
    # 将环境变量的值按照换行或者 "@" 分割，并过滤空白行
    accounts = [line.strip() for line in env_value.strip().replace('@', '\n').split("\n") if line.strip()]
    return accounts

def perform_sign_in(index, account, headers):
    """使用账号信息进行签到"""
    # 如果账号包含 "#" 分隔符，则分割为 token 和备注
    token, remark = account.split("#") if "#" in account else (account, "")
    headers['token'] = token

    url = "https://ys.shajixueyuan.com/api/user_sign/sign"
    try:
        response = requests.post(url, headers=headers, timeout=10)
        response.raise_for_status()  # 如果状态码不是 200, 抛出异常
        return response.json(), remark
    except requests.RequestException as e:
        print(f"❌ 账号{index}. {remark} 签到请求异常: {e}")
        return {"error": f"请求异常: {e}"}, remark
    except ValueError:
        print(f"❌ 账号{index}. {remark} 签到响应解析失败，无法解析JSON")
        return {"error": "响应解析失败，无法解析JSON"}, remark

def handle_sign_in_response(index, response, remark):
    """处理签到响应"""
    if 'error' in response:
        print(f"❌ 账号{index}. {remark} 签到失败：{response['error']}")
    elif response.get('code') == 0:
        msg = response.get('msg', '')
        if "已经签到" in msg:
            print(f"⚠️ 账号{index}. {remark} 签到失败：{msg}")
        else:
            print(f"✅ 账号{index}. {remark} 签到成功：{msg}")
    else:
        error_message = response.get('msg', '未知错误')
        print(f"❌ 账号{index}. {remark} 签到失败：{error_message}")

def perform_withdrawal(index, account, remark, headers):
    """提现申请"""
    url = "https://ys.shajixueyuan.com/api/user.user_withdraw/apply"
    payload = {
        "fruit_withdraw_amount": "0.3",
        "pay_gateway": "wechat"
    }
    headers['Content-Type'] = "application/json"
    
    try:
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        response.raise_for_status()  # 如果状态码不是 200, 抛出异常
        response_json = response.json()
        if response_json.get('code') == 0:
            print(f"✅ 账号{index}. {remark} 提现申请状态：{response_json['msg']}")
        else:
            error_msg = response_json.get('msg', '未知错误')
            print(f"❌ 账号{index}. {remark} 提现申请状态失败：{error_msg}")
    except requests.RequestException as e:
        print(f"❌ 账号{index}. {remark} 提现申请异常: {e}")

# 主程序逻辑
if __name__ == "__main__":
    accounts = get_accounts_from_env('dfjsck')

    headers = {
        'User-Agent': ("Mozilla/5.0 (Linux; Android 10; Mi 10 Pro Build/TKQ1.221114.001; wv) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.120 "
                       "Mobile Safari/537.36 XWEB/1220099 MMWEBSDK/20240301 MMWEBID/1663 MicroMessenger/8.0.48.2580"
                       "(0x28003052) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android"),
        'Accept': "application/json",
        'Accept-Encoding': "gzip,compress,br,deflate",
        'charset': "utf-8",
        'version': "1.0.13.2",
        'Referer': "https://servicewechat.com/wxebdf2c44a2a714c2/69/page-frame.html"
    }

    print("=== 东方棘市签到 ===")

    for index, account in enumerate(accounts, start=1):
        response, remark = perform_sign_in(index, account, headers)
        handle_sign_in_response(index, response, remark)
        time.sleep(5)  # Add a 5-second delay
        perform_withdrawal(index, account, remark, headers)
        time.sleep(5)  # Add another 5-second delay after withdrawal

    print("=== 所有账户签到和提现申请完成 ===")