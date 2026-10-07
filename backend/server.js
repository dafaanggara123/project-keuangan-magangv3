import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';


/* =========================================================
   ENVIRONMENT
   ========================================================= */

const {
  PORT = 4100,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  CORS_ORIGIN = 'http://localhost:5173'
} = process.env;


if (
  !SUPABASE_URL ||
  !SUPABASE_PUBLISHABLE_KEY ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    'SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di backend/.env'
  );

  process.exit(1);
}


/* =========================================================
   APP
   ========================================================= */

const app = express();


app.use(
  helmet()
);


app.use(
  cors({
    origin: true,
    credentials: true
  })
);


app.use(
  express.json({
    limit: '1mb'
  })
);


app.use(
  morgan('dev')
);


/* =========================================================
   SUPABASE CLIENT
   ========================================================= */

const authClient =
  createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );


/*
 * Service role hanya digunakan backend.
 * Jangan pernah kirim key ini ke frontend.
 */

const admin =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );


/* =========================================================
   VALIDATION
   ========================================================= */

const expenseSchema =
  z.object({

    expenseDate:
      z.string()
        .min(10)
        .max(10),

    categoryId:
      z.coerce
        .number()
        .int()
        .positive()
        .optional(),

    category:
      z.string()
        .trim()
        .min(2)
        .max(80)
        .optional(),

    note:
      z.string()
        .trim()
        .min(2)
        .max(300)
        .optional(),

    description:
      z.string()
        .trim()
        .min(2)
        .max(300)
        .optional(),

    amount:
      z.coerce
        .number()
        .min(0)

  })
  .superRefine(
    (data, ctx) => {

      if (
        !data.categoryId &&
        !data.category
      ) {

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['categoryId'],
          message:
            'Kategori pengeluaran wajib dipilih.'
        });

      }

    }
  );


const settingsSchema =
  z.object({

    businessName:
      z.string()
        .trim()
        .min(2)
        .max(120),

    shopeefoodPlatformRate:
      z.coerce
        .number()
        .min(0)
        .max(100)
        .default(25),

    targetDailySales:
      z.coerce
        .number()
        .min(0)
        .default(0),

    targetMonthlySales:
      z.coerce
        .number()
        .min(0)
        .default(0)

  });


/* =========================================================
   AUTH
   ========================================================= */

function bearer(req) {

  return (
    req.headers.authorization || ''
  )
    .replace(
      /^Bearer\s+/i,
      ''
    )
    .trim();

}


async function authOwner(
  req,
  res,
  next
) {

  try {

    const token =
      bearer(req);


    if (!token) {

      return res
        .status(401)
        .json({
          error:
            'Authentication diperlukan.'
        });

    }


    const {
      data,
      error
    } =
      await authClient.auth.getUser(
        token
      );


    if (
      error ||
      !data?.user
    ) {

      return res
        .status(401)
        .json({
          error:
            'Token tidak valid atau kadaluarsa.'
        });

    }


    const {
      data: profile,
      error: profileError
    } =
      await admin
        .from('profiles')
        .select(
          `
            id,
            full_name,
            phone,
            address,
            latitude,
            longitude,
            role,
            created_at
          `
        )
        .eq(
          'id',
          data.user.id
        )
        .single();


    if (
      profileError ||
      !profile
    ) {

      return res
        .status(403)
        .json({
          error:
            'Profil pengguna belum tersedia.',
          detail:
            profileError?.message ||
            null
        });

    }


    if (
      profile.role !== 'owner'
    ) {

      return res
        .status(403)
        .json({
          error:
            'Akses khusus owner.'
        });

    }


    req.user =
      data.user;

    req.profile =
      profile;


    next();

  } catch (error) {

    next(error);

  }

}


/* =========================================================
   GANTI PASSWORD
   ========================================================= */

const changePasswordSchema =
  z.object({

    currentPassword:
      z.string()
        .min(1),

    newPassword:
      z.string()
        .min(6)
        .max(100)

  });


/* =========================================================
   DATE HELPERS
   ========================================================= */

function dateRange(
  range = '30d'
) {

  const now =
    new Date();


  const start =
    new Date(
      now
    );


  if (
    range === 'today'
  ) {

    start.setHours(
      0,
      0,
      0,
      0
    );

  } else if (
    range === '7d'
  ) {

    start.setDate(
      start.getDate() - 6
    );

  } else if (
    range === '30d'
  ) {

    start.setDate(
      start.getDate() - 29
    );

  } else if (
    range === '90d'
  ) {

    start.setDate(
      start.getDate() - 89
    );

  } else {

    start.setDate(
      start.getDate() - 29
    );

  }


  return {
    start,
    end: now
  };

}


function isoDate(date) {

  return date
    .toISOString()
    .slice(0, 10);

}


/* =========================================================
   SETTINGS
   ========================================================= */

async function getSettings() {

  const {
    data,
    error
  } =
    await admin
      .from(
        'financial_settings'
      )
      .select(
        `
          id,
          business_name,
          shopeefood_platform_rate,
          target_daily_sales,
          target_monthly_sales,
          updated_at
        `
      )
      .eq(
        'id',
        1
      )
      .maybeSingle();


  if (error) {

    throw new Error(
      error.message
    );

  }


  return (
    data || {
      id: 1,
      business_name:
        'Dapoersari',
      shopeefood_platform_rate:
        25,
      target_daily_sales:
        0,
      target_monthly_sales:
        0
    }
  );

}


/* =========================================================
   SETTINGS RESPONSE NORMALIZER
   ========================================================= */

function normalizeSettings(
  settings
) {

  return {

    id:
      settings.id,

    businessName:
      settings.business_name,

    shopeefoodPlatformRate:
      Number(
        settings.shopeefood_platform_rate ||
        0
      ),

    targetDailySales:
      Number(
        settings.target_daily_sales ||
        0
      ),

    targetMonthlySales:
      Number(
        settings.target_monthly_sales ||
        0
      ),

    updatedAt:
      settings.updated_at || null

  };

}


/* =========================================================
   ORDER HELPERS
   ========================================================= */

async function fetchOrders(
  start,
  end
) {

  const {
    data,
    error
  } =
    await admin
      .from('orders')
      .select(
        `
          id,
          order_code,
          total,
          sales_channel,
          status,
          payment_status,
          ordered_at
        `
      )
      .gte(
        'ordered_at',
        start.toISOString()
      )
      .lte(
        'ordered_at',
        end.toISOString()
      )
      .order(
        'ordered_at',
        {
          ascending:
            false
        }
      );


  if (error) {

    console.error(
      'ORDER DATABASE ERROR:',
      error
    );

    throw new Error(
      error.message
    );

  }


  return (
    data || []
  );

}


function completedOrders(
  orders
) {

  return orders.filter(
    (order) =>

      order.status ===
      'completed' &&

      Number(
        order.total || 0
      ) > 0
  );

}


/* =========================================================
   FINANCIAL CALCULATION
   ========================================================= */

function calculateSummary(
  orders,
  rate
) {

  const valid =
    completedOrders(
      orders
    );


  const grossSales =
    valid.reduce(
      (
        sum,
        order
      ) =>

        sum +
        Number(
          order.total || 0
        ),

      0
    );


  const shopeefoodGross =
    valid

      .filter(
        (order) =>
          String(
            order.sales_channel ||
            ''
          ).toLowerCase()
          ===
          'shopeefood'
      )

      .reduce(
        (
          sum,
          order
        ) =>

          sum +
          Number(
            order.total || 0
          ),

        0
      );


  const platformDeduction =
    shopeefoodGross *
    (
      Number(rate || 0) /
      100
    );


  const netSales =
    grossSales -
    platformDeduction;


  const channel = {

    website:
      valid

        .filter(
          (order) =>
            String(
              order.sales_channel ||
              ''
            ).toLowerCase()
            ===
            'website'
        )

        .reduce(
          (
            sum,
            order
          ) =>

            sum +
            Number(
              order.total || 0
            ),

          0
        ),


    offline:
      valid

        .filter(
          (order) =>
            String(
              order.sales_channel ||
              ''
            ).toLowerCase()
            ===
            'offline'
        )

        .reduce(
          (
            sum,
            order
          ) =>

            sum +
            Number(
              order.total || 0
            ),

          0
        ),


    shopeefood:
      Math.max(
        0,
        shopeefoodGross - platformDeduction
      )

  };


  return {

    grossSales,

    platformDeduction,

    netSales,

    channel,

    transactionCount:
      valid.length

  };

}


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  '/api/health',
  (req, res) => {

    res.json({
      ok: true,

      service:
        'dapoersari-project-2',

      time:
        new Date()
          .toISOString()

    });

  }
);


/* =========================================================
   LOGIN
   ========================================================= */

app.post(
  '/api/auth/login',
  async (
    req,
    res,
    next
  ) => {

    try {

      const email =
        String(
          req.body?.email ||
          ''
        ).trim();


      const password =
        String(
          req.body?.password ||
          ''
        );


      if (
        !email ||
        !password
      ) {

        return res
          .status(400)
          .json({
            error:
              'Email dan password wajib diisi.'
          });

      }


      const {
        data,
        error
      } =
        await authClient.auth
          .signInWithPassword({
            email,
            password
          });


      if (
        error ||
        !data?.session
      ) {

        return res
          .status(401)
          .json({
            error:
              'Email atau kata sandi tidak valid.'
          });

      }


      const {
        data: profile,
        error: profileError
      } =
        await admin
          .from('profiles')
          .select(
            `
              id,
              full_name,
              phone,
              address,
              latitude,
              longitude,
              role,
              created_at
            `
          )
          .eq(
            'id',
            data.user.id
          )
          .single();


      if (
        profileError ||
        !profile
      ) {

        return res
          .status(403)
          .json({
            error:
              'Profil pengguna belum tersedia.'
          });

      }


      // Check approval status stored in user metadata (or defaults to approved for original owner)
      const approvalStatus = data.user.user_metadata?.approval_status || (profile.role === 'owner' ? 'approved' : 'pending');

      if (
        profile.role !== 'owner' || approvalStatus !== 'approved'
      ) {
        if (approvalStatus === 'pending') {
          return res
            .status(403)
            .json({
              error:
                'Akun Anda masih dalam status menunggu verifikasi administrator.'
            });
        }

        return res
          .status(403)
          .json({
            error:
              'Akses ditolak. Akun ini bukan akun Owner terverifikasi.'
          });

      }


      res.json({
        session: data.session,
        user: data.user,
        profile
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   REGISTER AS OWNER (PENDING VERIFICATION)
   ========================================================= */

app.post(
  '/api/auth/register-owner',
  async (req, res, next) => {
    try {
      const fullName = String(req.body?.fullName || req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!fullName || !email || !password) {
        return res.status(400).json({
          error: 'Periksa kembali data pendaftaran Anda.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password minimal 6 karakter.'
        });
      }

      // Check if user already exists in auth
      const { data: listData } = await admin.auth.admin.listUsers();
      const existingUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === email
      );

      if (existingUser) {
        return res.status(400).json({
          error: 'Email sudah terdaftar. Silakan gunakan email lain atau kembali ke Login.'
        });
      }

      // Create user with Supabase admin Auth, strictly setting approval_status: 'pending' and requested_role: 'owner'
      // Note: role in profiles defaults to 'customer' until an admin verifies and approves as 'owner'
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          requested_role: 'owner',
          approval_status: 'pending',
          requested_at: new Date().toISOString()
        }
      });

      if (createError || !newUser?.user) {
        console.error('Error creating user:', createError);
        return res.status(400).json({
          error: createError?.message?.includes('already registered')
            ? 'Email sudah terdaftar. Silakan gunakan email lain atau kembali ke Login.'
            : 'Periksa kembali data pendaftaran Anda.'
        });
      }

      // Ensure profile row exists with role: 'customer' (strictly not owner yet)
      const userId = newUser.user.id;
      const { error: profileError } = await admin.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        role: 'customer',
        updated_at: new Date().toISOString()
      });

      if (profileError) {
        console.warn('Profile upsert warning:', profileError.message);
      }

      return res.json({
        message: 'Permintaan akses Owner Anda telah diterima dan sedang menunggu verifikasi administrator.',
        email,
        status: 'pending'
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   FORGOT PASSWORD & RESET PASSWORD
   ========================================================= */

app.post(
  '/api/auth/forgot-password',
  async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          error: 'Alamat email wajib diisi.'
        });
      }

      // Check whether user exists and is an owner in profiles
      // Generic security message is returned regardless of user existence
      const origin = req.headers.origin || CORS_ORIGIN || 'http://localhost:5173';
      const redirectTo = `${origin}/reset-password`;

      // Trigger standard Supabase reset password flow
      try {
        await authClient.auth.resetPasswordForEmail(email, {
          redirectTo
        });
      } catch (err) {
        console.warn('Password reset request error (logged server-side only):', err?.message);
      }

      // Always return standard security response (does not disclose user existence)
      return res.json({
        message: 'Jika email tersebut terdaftar, instruksi reset kata sandi telah dikirim ke alamat email Anda.'
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/auth/reset-password',
  async (req, res, next) => {
    try {
      const token = bearer(req) || String(req.body?.token || req.body?.accessToken || '').trim();
      const newPassword = String(req.body?.password || req.body?.newPassword || '');

      if (!token) {
        return res.status(401).json({
          error: 'Link reset sudah tidak valid atau telah kedaluwarsa. Silakan minta link reset baru.'
        });
      }

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          error: 'Kata sandi baru minimal harus 6 karakter.'
        });
      }

      // Verify token with Supabase Auth
      const { data: userData, error: userError } = await authClient.auth.getUser(token);

      if (userError || !userData?.user) {
        return res.status(401).json({
          error: 'Link reset sudah tidak valid atau telah kedaluwarsa. Silakan minta link reset baru.'
        });
      }

      const userId = userData.user.id;

      // Ensure user role in profiles is owner (Project 2 owner only)
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .single();

      if (profileError || !profile || profile.role !== 'owner') {
        return res.status(403).json({
          error: 'Akses ditolak. Layanan reset kata sandi ini khusus untuk akun Owner Dapoersari.'
        });
      }

      // Update password using admin client
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (updateError) {
        return res.status(400).json({
          error: updateError.message || 'Gagal memperbarui kata sandi.'
        });
      }

      return res.json({
        message: 'Kata sandi berhasil diperbarui.'
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   CURRENT USER
   ========================================================= */

app.get(
  '/api/me',
  authOwner,
  (req, res) => {

    res.json({

      user: {

        id:
          req.user.id,

        email:
          req.user.email

      },

      profile:
        req.profile

    });

  }
);


/* =========================================================
   DASHBOARD
   ========================================================= */

app.get(
  '/api/dashboard',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const range =
        String(
          req.query.range ||
          '30d'
        );


      const {
        start,
        end
      } =
        dateRange(
          range
        );


      const [
        orders,
        settings,
        expenseResult
      ] =
        await Promise.all([

          fetchOrders(
            start,
            end
          ),

          getSettings(),

          admin
            .from('expenses')
            .select(
              `
                id,
                expense_date,
                category,
                description,
                amount
              `
            )
            .gte(
              'expense_date',
              isoDate(start)
            )
            .lte(
              'expense_date',
              isoDate(end)
            )
            .order(
              'expense_date',
              {
                ascending:
                  true
              }
            )

        ]);


      if (
        expenseResult.error
      ) {

        throw new Error(
          expenseResult.error.message
        );

      }


      const expenses =
        expenseResult.data ||
        [];


      const rate =
        Number(
          settings.shopeefood_platform_rate ||
          25
        );


      const summary =
        calculateSummary(
          orders,
          rate
        );


      const expenseTotal =
        expenses.reduce(
          (
            sum,
            expense
          ) =>

            sum +
            Number(
              expense.amount ||
              0
            ),

          0
        );


      const daily = {};
      const platformRate =
        Number(
          rate || 0
        ) / 100;


      for (
        const order
        of completedOrders(
          orders
        )
      ) {

        const key =
          order.ordered_at
            .slice(
              0,
              10
            );

        const grossAmount =
          Number(
            order.total ||
            0
          );

        const isShopeeFood =
          String(
            order.sales_channel ||
            ''
          ).toLowerCase() ===
          'shopeefood';

        const netAmount =
          isShopeeFood
            ? grossAmount * (1 - platformRate)
            : grossAmount;


        daily[key] =
          (
            daily[key] ||
            0
          ) +
          netAmount;

      }


      const trend = [];


      const cursor =
        new Date(
          start
        );


      cursor.setHours(
        0,
        0,
        0,
        0
      );


      const finish =
        new Date(
          end
        );


      finish.setHours(
        0,
        0,
        0,
        0
      );


      while (
        cursor <=
        finish
      ) {

        const key =
          isoDate(
            cursor
          );


        trend.push({

          date:
            key,

          sales:
            daily[key] ||
            0

        });


        cursor.setDate(
          cursor.getDate() +
          1
        );

      }


      res.json({

        range,

        summary: {

          ...summary,

          expenseTotal,

          netProfit:
            summary.netSales -
            expenseTotal

        },

        expenseCount:
          expenses.length,

        trend,

        settings:
          normalizeSettings(
            settings
          )

      });

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   SALES
   ========================================================= */

app.get(
  '/api/sales',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const range =
        String(
          req.query.range ||
          '30d'
        );


      const {
        start,
        end
      } =
        dateRange(
          range
        );


      const settings =
        await getSettings();

      const platformRate =
        Number(
          settings.shopeefood_platform_rate ||
          0
        ) / 100;


      const {
        data,
        error
      } =
        await admin
          .from('orders')
          .select(
            `
              id,
              order_code,
              total,
              sales_channel,
              status,
              payment_status,
              ordered_at
            `
          )
          .gte(
            'ordered_at',
            start.toISOString()
          )
          .lte(
            'ordered_at',
            end.toISOString()
          )
          .order(
            'ordered_at',
            {
              ascending:
                false
            }
          );


      if (error) {

        return res
          .status(400)
          .json({
            error:
              error.message
          });

      }


      const rows =
        (data || [])

          .filter(
            (order) =>
              order.status ===
              'completed'
          )

          .map(
            (order) => {

              const grossTotal =
                Number(
                  order.total ||
                  0
                );

              const channel =
                String(
                  order.sales_channel ||
                  'website'
                ).toLowerCase();

              const netTotal =
                channel === 'shopeefood'
                  ? grossTotal * (1 - platformRate)
                  : grossTotal;

              return {
                id:
                  order.id,

                orderCode:
                  order.order_code,

                total:
                  netTotal,

                grossTotal,

                netTotal,

                channel,

                status:
                  order.status,

                paymentStatus:
                  order.payment_status,

                orderedAt:
                  order.ordered_at

              };

            }
          );


      res.json({

        range,

        rows

      });

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   SALES DETAIL
   ========================================================= */

app.get(
  '/api/sales/:id',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const id =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(id)
      ) {

        return res
          .status(400)
          .json({
            error:
              'ID transaksi tidak valid.'
          });

      }


      const {
        data,
        error
      } =
        await admin
          .from('orders')
          .select(
            `
              id,
              order_code,
              customer_name,
              total,
              sales_channel,
              payment_method,
              payment_status,
              status,
              ordered_at,

              order_items(
                id,
                quantity,
                unit_price,
                spice_level,
                notes,

                menu(
                  id,
                  name,
                  image_url
                )
              )
            `
          )
          .eq(
            'id',
            id
          )
          .single();


      if (error) {

        return res
          .status(400)
          .json({
            error:
              error.message
          });

      }


      if (!data) {

        return res
          .status(404)
          .json({
            error:
              'Transaksi tidak ditemukan.'
          });

      }

      const grossTotal =
        Number(
          data.total ||
          0
        );

      const channel =
        String(
          data.sales_channel ||
          'website'
        ).toLowerCase();

      const settings =
        await getSettings();

      const platformRate =
        Number(
          settings.shopeefood_platform_rate ||
          0
        ) / 100;

      const netTotal =
        channel === 'shopeefood'
          ? grossTotal * (1 - platformRate)
          : grossTotal;


      res.json({
        ...data,
        gross_total: grossTotal,
        net_total: netTotal
      });

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   ANALYTICS
   ========================================================= */

app.get(
  '/api/analytics',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const range =
        String(
          req.query.range ||
          '30d'
        );


      const {
        start,
        end
      } =
        dateRange(
          range
        );


      const ordersRaw =
        await fetchOrders(
          start,
          end
        );


      const validOrders =
        completedOrders(
          ordersRaw
        );


      const orderIds =
        validOrders.map(
          (order) =>
            order.id
        );


      const [
        itemResult,
        settings
      ] =
        await Promise.all([

          orderIds.length

            ? admin
                .from(
                  'order_items'
                )
                .select(
                  `
                    order_id,
                    menu_id,
                    quantity,
                    unit_price,

                    menu:menu_id(
                      id,
                      name
                    )
                  `
                )
                .in(
                  'order_id',
                  orderIds
                )

            : Promise.resolve({
                data: [],
                error: null
              }),

          getSettings()

        ]);


      if (
        itemResult.error
      ) {

        throw new Error(
          itemResult.error.message
        );

      }


      const items =
        itemResult.data ||
        [];

      const orderChannelMap =
        new Map(
          validOrders.map(
            (order) => [
              order.id,
              String(
                order.sales_channel ||
                'website'
              ).toLowerCase()
            ]
          )
        );

      const platformRate =
        Number(
          settings.shopeefood_platform_rate ||
          0
        ) / 100;


      const products =
        {};


      for (
        const item
        of items
      ) {

        const id =
          item.menu_id;


        const name =
          item.menu?.name ||
          `Menu #${id}`;


        if (
          !products[id]
        ) {

          products[id] = {

            menuId:
              id,

            name,

            quantity:
              0,

            revenue:
              0

          };

        }


        products[id].quantity +=
          Number(
            item.quantity ||
            0
          );


        const itemGrossRevenue =
          Number(
            item.quantity ||
            0
          ) *
          Number(
            item.unit_price ||
            0
          );

        const isShopeeFood =
          orderChannelMap.get(
            item.order_id
          ) === 'shopeefood';

        products[id].revenue +=
          isShopeeFood
            ? itemGrossRevenue * (1 - platformRate)
            : itemGrossRevenue;

      }


      const productList =
        Object.values(
          products
        )
        .sort(
          (
            a,
            b
          ) =>
            b.quantity -
            a.quantity
        );


      const hourly =
        Array.from(
          {
            length: 24
          },
          (_, hour) => ({

            hour,

            transactions:
              0,

            revenue:
              0

          })
        );


      for (
        const order
        of validOrders
      ) {

        const date =
          new Date(
            order.ordered_at
          );


        const hour =
          date.getHours();


        hourly[hour].transactions +=
          1;


        const grossRevenue =
          Number(
            order.total ||
            0
          );

        const isShopeeFood =
          String(
            order.sales_channel ||
            ''
          ).toLowerCase() ===
          'shopeefood';

        hourly[hour].revenue +=
          isShopeeFood
            ? grossRevenue * (1 - platformRate)
            : grossRevenue;

      }


      const channelStats =
        [
          'website',
          'offline',
          'shopeefood'
        ]
        .map(
          (channel) => {

            const channelOrders =
              validOrders.filter(
                (order) =>

                  String(
                    order.sales_channel ||
                    ''
                  ).toLowerCase()
                  ===
                  channel
              );


            return {

              channel,

              transactions:
                channelOrders.length,

              revenue:
                channelOrders.reduce(
                  (
                    sum,
                    order
                  ) => {

                    const grossRevenue =
                      Number(
                        order.total ||
                        0
                      );

                    const isShopeeFood =
                      channel ===
                      'shopeefood';

                    const netRevenue =
                      isShopeeFood
                        ? grossRevenue * (1 - platformRate)
                        : grossRevenue;

                    return sum +
                      netRevenue;

                  },

                  0
                )

            };

          }
        );


      res.json({

        range,

        products:
          productList.slice(
            0,
            20
          ),

        channelStats,

        hourly,

        settings: {

          shopeefoodPlatformRate:
            Number(
              settings.shopeefood_platform_rate ||
              25
            )

        }

      });

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   RECOMMENDATIONS
   ========================================================= */

app.get(
  '/api/recommendations',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const range =
        String(
          req.query.range ||
          '30d'
        );


      const {
        start,
        end
      } =
        dateRange(
          range
        );


      const ordersRaw =
        await fetchOrders(
          start,
          end
        );


      const validOrders =
        completedOrders(
          ordersRaw
        );


      const orderIds =
        validOrders.map(
          (order) =>
            order.id
        );


      const [
        itemResult,
        settings
      ] =
        await Promise.all([

          orderIds.length

            ? admin
                .from(
                  'order_items'
                )
                .select(
                  `
                    order_id,
                    menu_id,
                    quantity,
                    unit_price,

                    menu:menu_id(
                      id,
                      name
                    )
                  `
                )
                .in(
                  'order_id',
                  orderIds
                )

            : Promise.resolve({
                data: [],
                error: null
              }),

          getSettings()

        ]);


      if (
        itemResult.error
      ) {

        throw new Error(
          itemResult.error.message
        );

      }


      const items =
        itemResult.data ||
        [];

      const orderChannelMap =
        new Map(
          validOrders.map(
            (order) => [
              order.id,
              String(
                order.sales_channel ||
                'website'
              ).toLowerCase()
            ]
          )
        );

      const rate =
        Number(
          settings.shopeefood_platform_rate ||
          25
        );

      const platformRate =
        rate / 100;


      const productMap =
        {};


      for (
        const item
        of items
      ) {

        const id =
          item.menu_id;


        const name =
          item.menu?.name ||
          `Menu #${id}`;


        if (
          !productMap[id]
        ) {

          productMap[id] = {

            name,

            quantity:
              0,

            revenue:
              0

          };

        }


        productMap[id].quantity +=
          Number(
            item.quantity ||
            0
          );


        const itemGrossRevenue =
          Number(
            item.quantity ||
            0
          ) *
          Number(
            item.unit_price ||
            0
          );

        const isShopeeFood =
          orderChannelMap.get(
            item.order_id
          ) === 'shopeefood';

        productMap[id].revenue +=
          isShopeeFood
            ? itemGrossRevenue * (1 - platformRate)
            : itemGrossRevenue;

      }


      const products =
        Object.values(
          productMap
        )
        .sort(
          (
            a,
            b
          ) =>
            b.quantity -
            a.quantity
        );


      const channelTotals =
        [
          'website',
          'offline',
          'shopeefood'
        ]
        .map(
          (channel) => ({

            channel,

            revenue:
              validOrders

                .filter(
                  (order) =>
                    String(
                      order.sales_channel ||
                      ''
                    ).toLowerCase()
                    ===
                    channel
                )

                .reduce(
                  (
                    sum,
                    order
                  ) =>

                    sum +
                    (
                      channel === 'shopeefood'
                        ? Number(order.total || 0) * (1 - platformRate)
                        : Number(order.total || 0)
                    ),

                  0
                )

          })
        );


      const recommendations =
        [];


      const top =
        products[0];


      const topChannel =
        [...channelTotals]
          .sort(
            (
              a,
              b
            ) =>
              b.revenue -
              a.revenue
          )[0];








      if (top) {

        recommendations.push({

          type:
            'product',

          level:
            'high',

          title:
            `Jaga stok ${top.name}`,

          text:
            `Produk ini menjadi yang paling banyak terjual (${top.quantity} item) pada periode yang dipilih.`

        });

      }


      if (
        topChannel &&
        topChannel.revenue > 0
      ) {

        recommendations.push({

          type:
            'channel',

          level:
            'medium',

          title:
            `Fokus channel ${topChannel.channel}`,

          text:
            `Channel ini menghasilkan omzet terbesar pada periode yang dipilih.`

        });

      }





      if (
        !recommendations.length
      ) {

        recommendations.push({

          type:
            'info',

          level:
            'low',

          title:
            'Belum cukup data',

          text:
            'Masukkan beberapa transaksi selesai agar rekomendasi lebih bermakna.'

        });

      }


      res.json({

        range,

        recommendations

      });

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   EXPENSE CATEGORIES
   ========================================================= */

const DEFAULT_EXPENSE_CATEGORIES = [

  {
    id: 1,
    name:
      'Bahan Baku'
  },

  {
    id: 2,
    name:
      'Operasional'
  },

  {
    id: 3,
    name:
      'Transportasi'
  },

  {
    id: 4,
    name:
      'Listrik'
  },

  {
    id: 5,
    name:
      'Perawatan'
  },

  {
    id: 6,
    name:
      'Lainnya'
  }

];


app.get(
  '/api/expense-categories',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const {
        data,
        error
      } =
        await admin
          .from(
            'expense_categories'
          )
          .select(
            'id,name'
          )
          .order(
            'name',
            {
              ascending:
                true
            }
          );


      /*
       * Jika tabel kategori tersedia,
       * gunakan data dari database.
       */

      if (!error) {

        return res.json(
          data || []
        );

      }


      /*
       * Fallback:
       * apabila tabel belum tersedia,
       * modal tetap memiliki kategori.
       */

      console.warn(
        'expense_categories tidak tersedia:',
        error.message
      );


      return res.json(
        DEFAULT_EXPENSE_CATEGORIES
      );

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   EXPENSES - GET
   ========================================================= */

app.get(
  '/api/expenses',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const {
        data,
        error
      } =
        await admin
          .from('expenses')
          .select(
            `
              id,
              expense_date,
              category,
              description,
              amount,
              created_at,
              updated_at
            `
          )
          .order(
            'expense_date',
            {
              ascending:
                false
            }
          )
          .order(
            'id',
            {
              ascending:
                false
            }
          );


      if (error) {

        throw new Error(
          error.message
        );

      }


      const rows =
        (
          data || []
        )
        .map(
          (expense) => ({

            id:
              expense.id,

            categoryName:
              expense.category ||
              'Tanpa kategori',

            amount:
              Number(
                expense.amount ||
                0
              ),

            expenseDate:
              expense.expense_date ||
              null,

            note:
              expense.description ||
              '-',

            createdAt:
              expense.created_at ||
              null,

            updatedAt:
              expense.updated_at ||
              null

          })
        );


      res.json(
        rows
      );

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   RESOLVE CATEGORY NAME
   ========================================================= */

async function resolveExpenseCategory(
  categoryId,
  categoryName
) {

  if (
    categoryName &&
    String(
      categoryName
    ).trim()
  ) {

    return String(
      categoryName
    ).trim();

  }


  if (
    categoryId
  ) {

    const {
      data,
      error
    } =
      await admin
        .from(
          'expense_categories'
        )
        .select(
          'name'
        )
        .eq(
          'id',
          categoryId
        )
        .maybeSingle();


    if (
      !error &&
      data?.name
    ) {

      return data.name;

    }


    const fallback =
      DEFAULT_EXPENSE_CATEGORIES
        .find(
          (item) =>
            Number(
              item.id
            ) ===
            Number(
              categoryId
            )
        );


    if (
      fallback
    ) {

      return fallback.name;

    }

  }


  return 'Lainnya';

}


/* =========================================================
   EXPENSES - POST
   ========================================================= */

app.post(
  '/api/expenses',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const parsed =
        expenseSchema.safeParse(
          req.body
        );


      if (
        !parsed.success
      ) {

        return res
          .status(400)
          .json({

            error:
              'Data pengeluaran tidak valid.',

            details:
              parsed.error.flatten()

          });

      }


      const category =
        await resolveExpenseCategory(

          parsed.data.categoryId,

          parsed.data.category

        );


      const description =
        parsed.data.note ||
        parsed.data.description ||
        'Pengeluaran';


      const {
        data,
        error
      } =
        await admin
          .from('expenses')
          .insert({

            expense_date:
              parsed.data.expenseDate,

            category,

            description,

            amount:
              parsed.data.amount,

            created_by:
              req.user.id

          })
          .select(
            `
              id,
              expense_date,
              category,
              description,
              amount,
              created_at,
              updated_at
            `
          )
          .single();


      if (error) {

        throw new Error(
          error.message
        );

      }


      res
        .status(201)
        .json({

          id:
            data.id,

          categoryName:
            data.category,

          amount:
            Number(
              data.amount ||
              0
            ),

          expenseDate:
            data.expense_date,

          note:
            data.description,

          createdAt:
            data.created_at,

          updatedAt:
            data.updated_at

        });

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   EXPENSES - UPDATE
   ========================================================= */

app.put(
  '/api/expenses/:id',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const parsed =
        expenseSchema.safeParse(
          req.body
        );


      if (
        !parsed.success
      ) {

        return res
          .status(400)
          .json({

            error:
              'Data pengeluaran tidak valid.',

            details:
              parsed.error.flatten()

          });

      }


      const category =
        await resolveExpenseCategory(

          parsed.data.categoryId,

          parsed.data.category

        );


      const description =
        parsed.data.note ||
        parsed.data.description ||
        'Pengeluaran';


      const {
        data,
        error
      } =
        await admin
          .from('expenses')
          .update({

            expense_date:
              parsed.data.expenseDate,

            category,

            description,

            amount:
              parsed.data.amount,

            updated_at:
              new Date()
                .toISOString()

          })
          .eq(
            'id',
            req.params.id
          )
          .select(
            `
              id,
              expense_date,
              category,
              description,
              amount,
              created_at,
              updated_at
            `
          )
          .single();


      if (error) {

        throw new Error(
          error.message
        );

      }


      res.json({

        id:
          data.id,

        categoryName:
          data.category,

        amount:
          Number(
            data.amount ||
            0
          ),

        expenseDate:
          data.expense_date,

        note:
          data.description,

        createdAt:
          data.created_at,

        updatedAt:
          data.updated_at

      });

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   EXPENSES - DELETE
   ========================================================= */

app.delete(
  '/api/expenses/:id',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const {
        error
      } =
        await admin
          .from('expenses')
          .delete()
          .eq(
            'id',
            req.params.id
          );


      if (error) {

        throw new Error(
          error.message
        );

      }


      res.json({
        ok: true
      });

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   SETTINGS - GET
   ========================================================= */

app.get(
  '/api/settings',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const settings =
        await getSettings();


      res.json(
        normalizeSettings(
          settings
        )
      );

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   SETTINGS - UPDATE
   ========================================================= */

app.put(
  '/api/settings',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      /*
       * Mendukung dua format:
       *
       * format frontend terbaru:
       * platformFee
       * dailyTarget
       * monthlyTarget
       *
       * format API lama:
       * shopeefoodPlatformRate
       * targetDailySales
       * targetMonthlySales
       */

      const normalizedBody = {

        businessName:
          req.body?.businessName,

        shopeefoodPlatformRate:
          req.body?.shopeefoodPlatformRate ??
          req.body?.platformFee ??
          25,

        targetDailySales:
          req.body?.targetDailySales ??
          req.body?.dailyTarget ??
          0,

        targetMonthlySales:
          req.body?.targetMonthlySales ??
          req.body?.monthlyTarget ??
          0

      };


      const parsed =
        settingsSchema.safeParse(
          normalizedBody
        );


      if (
        !parsed.success
      ) {

        return res
          .status(400)
          .json({

            error:
              'Pengaturan tidak valid.',

            details:
              parsed.error.flatten()

          });

      }


      const {
        data,
        error
      } =
        await admin
          .from(
            'financial_settings'
          )
          .upsert(

            {

              id:
                1,

              business_name:
                parsed.data.businessName,

              shopeefood_platform_rate:
                parsed.data
                  .shopeefoodPlatformRate,

              target_daily_sales:
                parsed.data
                  .targetDailySales,

              target_monthly_sales:
                parsed.data
                  .targetMonthlySales,

              updated_by:
                req.user.id,

              updated_at:
                new Date()
                  .toISOString()

            },

            {
              onConflict:
                'id'
            }

          )
          .select(
            `
              id,
              business_name,
              shopeefood_platform_rate,
              target_daily_sales,
              target_monthly_sales,
              updated_at
            `
          )
          .single();


      if (error) {

        throw new Error(
          error.message
        );

      }


      res.json(
        normalizeSettings(
          data
        )
      );

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   CHANGE PASSWORD
   ========================================================= */

app.post(
  '/api/auth/change-password',
  authOwner,
  async (
    req,
    res,
    next
  ) => {

    try {

      const parsed =
        changePasswordSchema.safeParse(
          req.body
        );


      if (
        !parsed.success
      ) {

        return res
          .status(400)
          .json({

            error:
              'Data password tidak valid.',

            details:
              parsed.error.flatten()

          });

      }


      const {
        currentPassword,
        newPassword
      } =
        parsed.data;


      const email =
        req.user?.email;


      if (!email) {

        return res
          .status(401)
          .json({

            error:
              'Email akun tidak ditemukan.'

          });

      }


      if (
        currentPassword ===
        newPassword
      ) {

        return res
          .status(400)
          .json({

            error:
              'Password baru harus berbeda dari password lama.'

          });

      }


      /* -----------------------------------------------
         VERIFIKASI PASSWORD LAMA
         ----------------------------------------------- */

      const {
        data:
          loginData,
        error:
          loginError
      } =
        await authClient.auth
          .signInWithPassword({

            email,

            password:
              currentPassword

          });


      if (
        loginError ||
        !loginData?.user
      ) {

        return res
          .status(401)
          .json({

            error:
              'Password saat ini salah.'

          });

      }


      /* -----------------------------------------------
         UPDATE PASSWORD
         ----------------------------------------------- */

      const {
        data:
          updatedUser,
        error:
          updateError
      } =
        await admin.auth.admin
          .updateUserById(

            req.user.id,

            {
              password:
                newPassword
            }

          );


      if (
        updateError
      ) {

        return res
          .status(400)
          .json({

            error:
              updateError.message

          });

      }


      if (
        !updatedUser?.user
      ) {

        return res
          .status(500)
          .json({

            error:
              'Password tidak berhasil diperbarui.'

          });

      }


      return res.json({

        success:
          true,

        message:
          'Password berhasil diubah.'

      });


    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   404 HANDLER
   ========================================================= */

app.use(
  (
    req,
    res
  ) => {

    res
      .status(404)
      .json({

        error:
          `Endpoint tidak ditemukan: ${req.method} ${req.path}`

      });

  }
);


/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      'PROJECT 2 ERROR:',
      err
    );


    if (
      res.headersSent
    ) {

      return next(err);

    }


    res
      .status(500)
      .json({

        error:
          err?.message ||
          'Internal server error.'

      });

  }
);


/* =========================================================
   START SERVER
   ========================================================= */

export default app;